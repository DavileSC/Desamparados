// El detalle de UN recibo del área de hermanos: GET /api/recibos/mis-recibos/:id.
//
// La lista de recibos no cabe entera en un móvil, así que la pantalla enseña
// lo justo por fila y el resto —tipo, método de pago, fechas— vive en esta
// ruta. Dos cosas que comprobar aquí y en ningún otro sitio:
//
//  1. El recibo tiene que ser de SU familia. El filtro es el mismo que el del
//     listado (`hermano: { userId, activo: true }`); si alguien lo cambiara por
//     un `findUnique` por id, cualquier hermano leería los recibos de los demás
//     cambiando un número en la URL. Por eso el segundo test siembra DOS
//     familias y pide la de al lado.
//  2. `observaciones` NO viaja. Es el campo de texto libre de Tesorería y
//     puede llevar notas internas («devuelto por falta de fondos, llamar»).
//     El servicio lo evita con un `select` explícito; si alguien lo sustituye
//     por un `include`, el campo se cuela y este test lo dice.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoPago, MetodoPago, Role, TipoRecibo } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const YEAR = new Date().getFullYear();

let dbDisponible = false;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

/**
 * Un usuario con una ficha de hermano y un recibo suyo. `recoger` lo borra
 * todo en orden inverso al de las claves ajenas, pase lo que pase: esto corre
 * contra la base de datos de desarrollo y no puede dejar basura.
 */
async function familia(nombre: string) {
  const usuario = await crearUsuarioPrueba(Role.USER);
  const hermano = await db.hermano.create({
    data: {
      userId: usuario.id,
      nombre,
      apellidos: `Detalle ${Date.now()}${process.pid}`,
      fechaNacimiento: new Date(Date.UTC(1990, 0, 1)),
      esTitular: true,
      activo: true
    }
  });

  return {
    usuario,
    hermano,
    cookie: `${COOKIE_HERMANO}=${generateToken(usuario.id, Role.USER, false, 'hermanos')}`,
    recibo: (extra: Partial<{ observaciones: string }> = {}) => db.recibo.create({
      data: {
        hermanoId: hermano.id,
        year: YEAR,
        concepto: `Cuota anual ${YEAR} ${Date.now()}`,
        importe: 30,
        tipo: TipoRecibo.CUOTA_HERMANO,
        estado: EstadoPago.PAGADO,
        fechaPago: new Date(),
        metodoPago: MetodoPago.TRANSFERENCIA,
        ...extra
      }
    }),
    recoger: async () => {
      await db.recibo.deleteMany({ where: { hermanoId: hermano.id } });
      await db.hermano.deleteMany({ where: { id: hermano.id } });
      await borrarUsuarioPrueba(usuario.id);
    }
  };
}

test('el detalle de un recibo propio trae tipo y método de pago, y nunca las observaciones de Tesorería', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const ana = await familia('Ana');
  try {
    const recibo = await ana.recibo({ observaciones: 'Nota interna: llamar al banco' });

    const respuesta = await fetch(`${baseUrl}/api/recibos/mis-recibos/${recibo.id}`, {
      headers: { Cookie: ana.cookie }
    });
    assert.equal(respuesta.status, 200);

    const cuerpo = await respuesta.json() as Record<string, unknown> & { hermano?: { nombre?: string } };

    assert.equal(cuerpo.id, recibo.id);
    assert.equal(cuerpo.year, YEAR);
    assert.equal(cuerpo.concepto, recibo.concepto);
    assert.equal(cuerpo.estado, EstadoPago.PAGADO);
    // Lo que la lista no enseña y sí justifica entrar en el recibo.
    assert.equal(cuerpo.tipo, TipoRecibo.CUOTA_HERMANO);
    assert.equal(cuerpo.metodoPago, MetodoPago.TRANSFERENCIA);
    assert.ok(typeof cuerpo.fechaEmision === 'string', 'la fecha de emisión tiene que viajar');
    assert.ok(typeof cuerpo.fechaPago === 'string', 'un recibo pagado tiene que decir cuándo se pagó');
    // De quién es: en una familia con varias fichas, el nombre es lo que
    // distingue un recibo de otro.
    assert.equal(cuerpo.hermano?.nombre, 'Ana');

    assert.ok(
      !('observaciones' in cuerpo),
      'las observaciones son notas internas de Tesorería: no pueden llegar al hermano'
    );
  } finally {
    await ana.recoger();
  }
});

test('el recibo de otra familia responde 404, no el recibo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const ana = await familia('Ana');
  const bruno = await familia('Bruno');
  try {
    const ajeno = await bruno.recibo();

    const respuesta = await fetch(`${baseUrl}/api/recibos/mis-recibos/${ajeno.id}`, {
      headers: { Cookie: ana.cookie }
    });

    assert.equal(
      respuesta.status, 404,
      'cambiar el id en la URL no puede enseñar el recibo de otra familia'
    );
  } finally {
    await bruno.recoger();
    await ana.recoger();
  }
});

test('sin sesión, el detalle de un recibo responde 401', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const ana = await familia('Ana');
  try {
    const propio = await ana.recibo();

    // Se sondea el servidor en vez de leer el router: en Express manda el orden
    // de declaración, y una ruta escrita por encima del `.use(authenticateToken)`
    // queda abierta aunque el fichero parezca correcto. Un 500 aquí querría
    // decir que la petición llegó a la base de datos sin sesión.
    const respuesta = await fetch(`${baseUrl}/api/recibos/mis-recibos/${propio.id}`);

    assert.equal(respuesta.status, 401, 'la ruta tiene que exigir sesión');
  } finally {
    await ana.recoger();
  }
});
