// Los cabildos contra MariaDB: el recorrido entero (convocar, preparar la
// convocatoria, apuntar asistencia y votaciones, celebrarlo con o sin quórum,
// redactar y aprobar el acta) y que con el acta aprobada no se toque nada.
// Los cabildos van en 2099, un año que nadie usa, y se recogen al terminar.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { CabildosService } from '../src/services/cabildos.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

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

async function escenario() {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const familia = await crearUsuarioPrueba(Role.USER);
  const hermanos: number[] = [];
  const cabildos: number[] = [];
  const hermano = async (datos: { fechaNacimiento?: string; fechaAlta?: string; activo?: boolean } = {}) => {
    const h = await db.hermano.create({
      data: {
        userId: familia.id, nombre: 'Prueba', apellidos: `Cabildo ${Date.now()}${hermanos.length}`,
        fechaNacimiento: new Date(`${datos.fechaNacimiento ?? '1980-01-01'}T00:00:00Z`),
        fechaAlta: new Date(`${datos.fechaAlta ?? '2000-01-01'}T10:00:00Z`), activo: datos.activo ?? true,
      },
    });
    hermanos.push(h.id);
    return h;
  };
  const convocar = async () => {
    const c = await CabildosService.crear({ tipo: 'ORDINARIO', fecha: '2099-10-15T18:30:00.000Z', lugar: 'Salón parroquial', ordenDelDia: ['Lectura del acta anterior', ' Cuentas del ejercicio ', ''] });
    cabildos.push(c.id);
    return c;
  };
  const recoger = async () => {
    const convocatorias = await db.cabildo.findMany({ where: { id: { in: cabildos } }, select: { convocatoriaId: true } });
    await db.cabildo.deleteMany({ where: { id: { in: cabildos } } });
    await db.comunicado.deleteMany({ where: { id: { in: convocatorias.flatMap((c) => (c.convocatoriaId ? [c.convocatoriaId] : [])) } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await db.auditLog.deleteMany({ where: { userId: staff.id } });
    await borrarUsuarioPrueba(familia.id);
    await borrarUsuarioPrueba(staff.id);
  };
  return { staff, meta: { userId: staff.id }, hermano, convocar, recoger };
}

test('convocar, apuntar asistencia y votaciones, celebrar, redactar y aprobar el acta', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const c = await e.convocar();
    assert.deepEqual(c.ordenDelDia, ['Lectura del acta anterior', 'Cuentas del ejercicio']);
    assert.equal(c.estado, 'CONVOCADO');

    // La convocatoria, como borrador de aviso a los mayores de edad; la segunda vez, la misma.
    const { comunicadoId } = await CabildosService.prepararConvocatoria(c.id, e.meta);
    const aviso = await db.comunicado.findUniqueOrThrow({ where: { id: comunicadoId } });
    assert.equal(aviso.tipo, 'AVISO');
    assert.deepEqual((aviso.segmento as { edad: string }).edad, 'MAYORES');
    assert.match(aviso.cuerpo, /<li>Cuentas del ejercicio<\/li>/);
    assert.equal((await CabildosService.prepararConvocatoria(c.id, e.meta)).comunicadoId, comunicadoId);

    const conVoto = await e.hermano();
    const joven = await e.hermano({ fechaNacimiento: '2085-01-01' }); // 14 años en 2099
    const nuevo = await e.hermano({ fechaAlta: '2099-06-01' }); // sin el año de antigüedad
    const deBaja = await e.hermano({ activo: false });
    for (const h of [conVoto, joven, nuevo]) await CabildosService.anadirAsistente(c.id, h.id);
    await assert.rejects(CabildosService.anadirAsistente(c.id, deBaja.id), (err: unknown) => err instanceof HttpError && /de baja/.test(err.message));
    const estado = await CabildosService.obtener(c.id);
    assert.deepEqual(estado.asistentes.map((a) => [a.hermanoId, a.conVoto]).sort(), [[conVoto.id, true], [joven.id, false], [nuevo.id, false]].sort());
    assert.equal(estado.quorum.presentesConVoto, 1);

    // Tres presentes, pero solo uno con voto: dos votos no caben.
    await assert.rejects(CabildosService.anadirVotacion(c.id, { asunto: 'Cuentas', mayoria: 'SIMPLE', aFavor: 1, enContra: 1, abstenciones: 0 }), (err: unknown) => err instanceof HttpError && /2 votos y solo hay 1 hermano presente con voto/.test(err.message));
    const conVotacion = await CabildosService.anadirVotacion(c.id, { asunto: 'Aprobación de las cuentas', mayoria: 'SIMPLE', aFavor: 1, enContra: 0, abstenciones: 0 });
    assert.equal(conVotacion.votaciones[0].resultado, 'APROBADO');

    // El censo de desarrollo es grande: con un presente no hay quórum en primera.
    await assert.rejects(CabildosService.darPorCelebrado(c.id, false, e.meta), (err: unknown) => err instanceof HttpError && err.status === 409 && /segunda/.test(err.message));
    await assert.rejects(CabildosService.guardarActa(c.id, '<p>x</p>'), (err: unknown) => err instanceof HttpError && err.status === 409);
    const celebrado = await CabildosService.darPorCelebrado(c.id, true, e.meta);
    assert.equal(celebrado.estado, 'CELEBRADO');
    assert.equal(celebrado.enSegunda, true);
    const censo = celebrado.quorum.censoConVoto;
    assert.ok(censo >= 1);

    // El censo queda fijado: una ficha nueva con voto no lo cambia.
    await e.hermano();
    assert.equal((await CabildosService.obtener(c.id)).quorum.censoConVoto, censo);

    await assert.rejects(CabildosService.aprobarActa(c.id, e.meta), (err: unknown) => err instanceof HttpError && /vacía/.test(err.message));
    const conActa = await CabildosService.guardarActa(c.id, '<p>Se abre la sesión.</p><script>x</script><p>Se aprueban las cuentas.</p>');
    assert.ok(!conActa.acta.includes('<script>'));

    const borrador = await CabildosService.actaPdf(c.id);
    assert.equal(borrador.pdf.subarray(0, 4).toString('latin1'), '%PDF');

    const aprobado = await CabildosService.aprobarActa(c.id, e.meta);
    assert.equal(aprobado.estado, 'ACTA_APROBADA');
    for (const intento of [
      () => CabildosService.guardarActa(c.id, '<p>otra</p>'),
      () => CabildosService.anadirAsistente(c.id, conVoto.id),
      () => CabildosService.anadirVotacion(c.id, { asunto: 'x', mayoria: 'SIMPLE', aFavor: 1, enContra: 0, abstenciones: 0 }),
      () => CabildosService.actualizar(c.id, { tipo: 'ORDINARIO', fecha: '2099-10-15T18:30:00.000Z', lugar: 'Otro', ordenDelDia: [] }),
    ]) {
      await assert.rejects(intento(), (err: unknown) => err instanceof HttpError && err.status === 409);
    }

    const libro = await CabildosService.libroDeActas(2099);
    assert.equal(libro.titulo, 'Libro de actas 2099');
    assert.ok(libro.pdf.length > 1000);
    await assert.rejects(CabildosService.libroDeActas(2098), (err: unknown) => err instanceof HttpError && err.status === 404);
  } finally {
    await e.recoger();
  }
});

test('solo se borra un cabildo convocado y sin asistencia', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const vacio = await e.convocar();
    await CabildosService.borrar(vacio.id);
    assert.equal(await db.cabildo.count({ where: { id: vacio.id } }), 0);

    const conGente = await e.convocar();
    await CabildosService.anadirAsistente(conGente.id, (await e.hermano()).id);
    await assert.rejects(CabildosService.borrar(conGente.id), (err: unknown) => err instanceof HttpError && err.status === 409);
  } finally {
    await e.recoger();
  }
});

test('los cabildos piden sesión de Secretaría, la administración o el Hermano Mayor', async (t) => {
  assert.equal((await fetch(`${baseUrl}/api/cabildos`)).status, 401);
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  const secretario = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    const como = (id: number, rol: Role) => ({ Cookie: `${COOKIE_CMS}=${generateToken(id, rol)}` });
    assert.equal((await fetch(`${baseUrl}/api/cabildos`, { headers: como(tesorero.id, Role.TESORERIA) })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/cabildos`, { headers: como(secretario.id, Role.SECRETARIA) })).status, 200);
    const mal = await fetch(`${baseUrl}/api/cabildos`, {
      method: 'POST', headers: { ...como(secretario.id, Role.SECRETARIA), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'ORDINARIO', fecha: 'mañana', lugar: 'Aquí', ordenDelDia: [] }),
    });
    assert.equal(mal.status, 400);
  } finally {
    await borrarUsuarioPrueba(tesorero.id);
    await borrarUsuarioPrueba(secretario.id);
  }
});
