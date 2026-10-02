// Los enganches opcionales entre módulos: lo que un módulo hace en otro solo
// si el otro está encendido. Y Datos e informes: las áreas de módulos
// apagados no salen, ni su informe, ni su capítulo del Informe anual.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { PlazoPapeletasService } from '../src/services/procesion/plazo.service.js';
import { SalidasService } from '../src/services/procesion/salidas.service.js';
import { areasActivas, MODULO_DE_AREA, vistazo, type Area } from '../src/domain/datos-areas.js';
import { DatosService } from '../src/services/datos.service.js';
import { periodoDe } from '../src/domain/periodo-datos.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const META = { ip: '127.0.0.1', userAgent: 'prueba-enganches' };
let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];
/** Cómo estaban los módulos antes de empezar, para dejarlos igual y no encender lo que la base tenía apagado. */
let foto: { clave: string; activo: boolean }[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (dbDisponible) foto = await db.modulo.findMany({ select: { clave: true, activo: true } });
});

after(async () => {
  if (dbDisponible) {
    await restaurar();
    await db.auditLog.deleteMany({ where: { userAgent: 'prueba-enganches' } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

async function apagar(claves: string[]) {
  await db.modulo.updateMany({ where: { clave: { in: claves } }, data: { activo: false } });
  await ModulosService.cargar();
}
async function restaurar() {
  for (const fila of foto) await db.modulo.update({ where: { clave: fila.clave }, data: { activo: fila.activo } });
  await ModulosService.cargar();
}
async function cargo(role: Role) {
  const u = await crearUsuarioPrueba(role);
  usuarios.push(u.id);
  return `${COOKIE_CMS}=${generateToken(u.id, role, false, 'cms')}`;
}

test('Procesión abre el plazo sin crear la noticia si Noticias está apagado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const salida = await SalidasService.porSlug('sabado-de-pasion');
  const abiertoAntes = salida.plazoAbierto;
  const noticiasAntes = await db.noticia.count();
  // Abrir el plazo exige un día de reparto por delante y la siembra solo crea
  // días pasados: la prueba trae el suyo, sin acto en la Agenda.
  const dia = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 30));
  let turnoId: number | null = null;
  try {
    turnoId = (await db.turno.create({
      data: { fecha: dia, horaInicio: new Date(dia.getTime() + 18 * 3_600_000), horaFin: new Date(dia.getTime() + 21 * 3_600_000), capacidadEstimada: 50, activo: true, salida: { connect: { id: salida.id } } },
    })).id;
    if (abiertoAntes) await PlazoPapeletasService.cambiar(false, {}, salida, META);
    await apagar(['noticias']);
    const r = await PlazoPapeletasService.cambiar(true, { borradorNoticia: true }, await SalidasService.porSlug('sabado-de-pasion'), META);
    assert.equal(r.noticiaId, null);
    assert.equal(r.abierto, true, 'el plazo se abre igual');
    assert.equal(await db.noticia.count(), noticiasAntes, 'ninguna noticia nueva');
  } finally {
    await restaurar();
    await PlazoPapeletasService.cambiar(abiertoAntes, {}, await SalidasService.porSlug('sabado-de-pasion'), META);
    // Después de dejar el plazo como estaba: cerrarlo no necesita días de reparto.
    if (turnoId !== null) await db.turno.deleteMany({ where: { id: turnoId } });
  }
});

test('un sufragio «en la Agenda» con la Agenda apagada no crea acto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const secretaria = await cargo(Role.SECRETARIA);
  const cuenta = await crearUsuarioPrueba(Role.USER);
  usuarios.push(cuenta.id);
  const marca = `Enganche${Date.now().toString(36)}`;
  const hermano = await db.hermano.create({
    data: { userId: cuenta.id, nombre: 'Ana', apellidos: `${marca} Gil`, fechaNacimiento: new Date(Date.UTC(1950, 1, 1)), activo: true, esTitular: true, fechaAlta: new Date(Date.UTC(1990, 0, 10)) },
  });
  const pedir = (ruta: string, init: { method?: string; json?: unknown } = {}) => fetch(`${baseUrl}/api/hermanos${ruta}`, {
    method: init.method ?? 'GET',
    headers: { Cookie: secretaria, ...(init.json !== undefined && { 'Content-Type': 'application/json' }) },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  try {
    assert.equal((await pedir(`/admin/${hermano.id}/baja`, { method: 'DELETE', json: { motivo: 'FALLECIMIENTO', fechaDefuncion: '2026-09-20' } })).status, 200);
    const eventosAntes = await db.evento.count();
    await apagar(['agenda', 'procesion', 'puerta']); // procesion requiere agenda: se apagan juntos
    const r = await pedir(`/admin/difuntos/${hermano.id}/sufragios`, { method: 'POST', json: { tipo: 'MISA_SUFRAGIO', fecha: '2026-12-01T19:00', enAgenda: true } });
    assert.equal(r.status, 200);
    assert.equal((await r.json() as { eventoId: number | null }).eventoId, null);
    assert.equal(await db.evento.count(), eventosAntes);
  } finally {
    await restaurar();
    await db.sufragio.deleteMany({ where: { hermanoId: hermano.id } });
    await db.hermano.deleteMany({ where: { id: hermano.id } });
  }
});

test('Datos e informes: fuera las áreas de módulos apagados, y su informe es un 404', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  assert.deepEqual(MODULO_DE_AREA, { hermanos: 'nucleo', dinero: 'nucleo', procesion: 'procesion', inventario: 'inventario', web: 'nucleo', agenda: 'agenda' });
  const areas = [{ clave: 'hermanos' }, { clave: 'procesion' }, { clave: 'agenda' }] as Area[];
  assert.deepEqual(areasActivas(areas, new Set(['agenda'])).map((a) => a.clave), ['hermanos', 'agenda']);

  const hermanoMayor = await cargo(Role.HERMANO_MAYOR);
  try {
    await apagar(['inventario']);
    const r = await fetch(`${baseUrl}/api/datos`, { headers: { Cookie: hermanoMayor } });
    assert.equal(r.status, 200);
    const claves = (await r.json() as { areas: { clave: string }[] }).areas.map((a) => a.clave);
    assert.ok(!claves.includes('inventario'), claves.join(','));
    assert.ok(claves.includes('procesion'));
    assert.equal((await fetch(`${baseUrl}/api/datos/informe/inventario`, { headers: { Cookie: hermanoMayor } })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/datos/informe/hermanos`, { headers: { Cookie: hermanoMayor } })).status, 200);
  } finally {
    await restaurar();
  }
});

test('el vistazo del Informe anual dice de qué área es cada cifra: sin Procesión no queda la de papeletas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hoy = new Date();
  const tarjetas = vistazo(await DatosService.crudos(periodoDe(hoy.getUTCFullYear() - 1, hoy), hoy), hoy);
  assert.ok(tarjetas.every((c) => c.area in MODULO_DE_AREA), 'cada tarjeta lleva su área');
  assert.equal(tarjetas.find((c) => c.etiqueta === 'Papeletas de sitio')?.area, 'procesion');
  // Lo mismo que hace la página del vistazo con las áreas que llegan filtradas.
  const sinProcesion = new Set(Object.keys(MODULO_DE_AREA).filter((a) => a !== 'procesion'));
  const quedan = tarjetas.filter((c) => sinProcesion.has(c.area));
  assert.ok(!quedan.some((c) => c.etiqueta === 'Papeletas de sitio'));
  assert.equal(quedan.length, tarjetas.length - 1);
});

test('el Informe anual en borrador sale sin el capítulo de Procesión cuando está apagada', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermanoMayor = await cargo(Role.HERMANO_MAYOR);
  const pdf = (cookie: string) => fetch(`${baseUrl}/api/datos/informe-anual/2001/pdf?borrador=1`, { headers: { Cookie: cookie } });
  try {
    const completo = await pdf(hermanoMayor);
    assert.equal(completo.status, 200);
    const paginasCompleto = (await completo.arrayBuffer()).byteLength;
    await apagar(['procesion', 'puerta']);
    const recortado = await pdf(hermanoMayor);
    assert.equal(recortado.status, 200);
    assert.ok((await recortado.arrayBuffer()).byteLength < paginasCompleto, 'con un capítulo menos pesa menos');
  } finally {
    await restaurar();
  }
});
