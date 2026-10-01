// La puerta del templo contra MariaDB: el QR de una papeleta de este año deja
// entrar una vez y la segunda dice «ya entró»; un código falso, el de otra
// salida o el de una papeleta anulada no entran; a mano entra quien no trae la
// papeleta, y deshacerlo queda en la auditoría. Pide la sesión de la Junta.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role, TipoRecibo } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { codigoDePapeleta } from '../src/domain/papeleta-qr.js';
import { anioDeLaMesa } from '../src/services/procesion/zonas.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { idDeSalida, PASION, ROSARIO, salida } from './fixtures/salidas.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
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

const cabeceras = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}`, 'Content-Type': 'application/json' });

test('escanear en la puerta: entra una vez, y lo que no vale no entra', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const diputado = await crearUsuarioPrueba(Role.SECRETARIA);
  const usuario = await crearUsuarioPrueba(Role.USER);
  const hermanos: number[] = [];
  try {
    const pasion = await salida(PASION);
    const year = anioDeLaMesa(pasion);
    const conPapeleta = async (slug: string, anio: number) => {
      const h = await db.hermano.create({
        data: { userId: usuario.id, nombre: 'Prueba', apellidos: `Puerta ${Date.now()}${hermanos.length}`, fechaNacimiento: new Date('1990-01-01T00:00:00Z') },
      });
      hermanos.push(h.id);
      const recibo = await db.recibo.create({ data: { hermanoId: h.id, year: anio, concepto: `Papeleta ${slug} ${anio}`, importe: '0', tipo: TipoRecibo.PAPELETA_SITIO } });
      return db.papeletaSitio.create({ data: { hermanoId: h.id, year: anio, salidaId: await idDeSalida(slug), puesto: 'Nazareno', tramo: 'Tramo 1', numero: 3, reciboId: recibo.id } });
    };
    const buena = await conPapeleta(PASION, year);
    const delRosario = await conPapeleta(ROSARIO, year);
    const sinPapeleta = await conPapeleta(PASION, year);

    const escanear = (codigo: string, cab = cabeceras(diputado.id, Role.SECRETARIA)) =>
      fetch(`${baseUrl}/api/procesion/admin/puerta/escanear`, { method: 'POST', headers: cab, body: JSON.stringify({ codigo, salida: PASION }) });

    // Sin sesión de la Junta no se escanea.
    assert.equal((await fetch(`${baseUrl}/api/procesion/admin/puerta/escanear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    assert.equal((await escanear(codigoDePapeleta(buena.id), cabeceras(usuario.id, Role.USER))).status, 403);

    const primera = await (await escanear(codigoDePapeleta(buena.id))).json();
    assert.equal(primera.veredicto, 'ENTRA');
    assert.equal(primera.papeleta.tramo, 'Tramo 1');
    assert.equal(primera.papeleta.entradaPor, diputado.nombre);
    assert.equal((await (await escanear(`  ${codigoDePapeleta(buena.id)}\n`)).json()).veredicto, 'REPETIDA');

    assert.deepEqual(await (await escanear(`DSP1.${buena.id}.AAAAAAAAAAAAAAAA`)).json(), { veredicto: 'FALSO', papeleta: null });
    assert.equal((await (await escanear(codigoDePapeleta(delRosario.id))).json()).veredicto, 'OTRA_SALIDA');
    assert.equal((await (await escanear(codigoDePapeleta(999_999_999))).json()).veredicto, 'ANULADA');

    // Quien llega sin la papeleta entra a mano.
    const aMano = await fetch(`${baseUrl}/api/procesion/admin/puerta/papeletas/${sinPapeleta.id}`, { method: 'POST', headers: cabeceras(diputado.id, Role.SECRETARIA), body: JSON.stringify({ salida: PASION }) });
    assert.equal((await aMano.json()).veredicto, 'ENTRA');

    const estado = await (await fetch(`${baseUrl}/api/procesion/admin/puerta?salida=${PASION}`, { headers: cabeceras(diputado.id, Role.SECRETARIA) })).json();
    assert.equal(estado.year, year);
    assert.ok(estado.ultimas.some((p: { id: number }) => p.id === buena.id));
    assert.ok(!estado.faltan.some((p: { id: number }) => p.id === buena.id || p.id === sinPapeleta.id));
    assert.ok(estado.tramos.find((x: { tramo: string }) => x.tramo === 'Tramo 1').dentro >= 2);

    // Deshacer: vuelve a faltar, y queda en la auditoría.
    const deshecha = await (await fetch(`${baseUrl}/api/procesion/admin/puerta/papeletas/${buena.id}`, { method: 'DELETE', headers: cabeceras(diputado.id, Role.SECRETARIA) })).json();
    assert.equal(deshecha.entradaEl, null);
    assert.equal(await db.auditLog.count({ where: { userId: diputado.id, action: 'PUERTA_DESHACER', entityId: String(buena.id) } }), 1);
    assert.equal((await (await escanear(codigoDePapeleta(buena.id))).json()).veredicto, 'ENTRA');
  } finally {
    await db.papeletaSitio.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await db.auditLog.deleteMany({ where: { userId: diputado.id } });
    await borrarUsuarioPrueba(usuario.id);
    await borrarUsuarioPrueba(diputado.id);
  }
});
