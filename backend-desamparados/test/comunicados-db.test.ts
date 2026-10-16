// El boletín y los avisos contra MariaDB, con un transporte de correo de
// mentira: quién entra en cada segmento, que enviar apunte a cada dirección una
// vez y las mande todas, que lo enviado ya no se toque, y la baja del boletín
// desde el enlace. Las fichas llevan una población inventada para no arrastrar
// a los hermanos de la base de desarrollo.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { EstadoPago, EstadoSolicitud, OrigenSolicitud, Role, TipoRecibo } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { ponerTransporte } from '../src/services/correos/envio.js';
import { ComunicadosService, envioTerminado } from '../src/services/comunicados.service.js';
import { tokenDeBaja } from '../src/domain/comunicados.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { SIN_DB } from './fixtures/sin-db.js';
import { encenderModulos } from './fixtures/modulos.js';
import { PASION, aLaSalida, literal, salida as salidaDePrueba } from './fixtures/salidas.js';
import { anioDeLaMesa } from '../src/services/procesion/zonas.service.js';

let dbDisponible = false;
let server: Server;
let baseUrl: string;
const enviados: { to: string; subject: string; html: string }[] = [];
const pausaPrevia = process.env.COMUNICADOS_PAUSA_MS;

before(async () => {
  process.env.COMUNICADOS_PAUSA_MS = '0';
  ponerTransporte({ sendMail: async (c) => { enviados.push(c as { to: string; subject: string; html: string }); } });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  ponerTransporte(undefined);
  if (pausaPrevia === undefined) delete process.env.COMUNICADOS_PAUSA_MS;
  else process.env.COMUNICADOS_PAUSA_MS = pausaPrevia;
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  await db.$disconnect();
});

async function escenario() {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const familia = await crearUsuarioPrueba(Role.USER);
  const pueblo = `Villaprueba${Date.now()}`;
  const hermanos: number[] = [];
  const comunicados: number[] = [];
  const ficha = async (datos: { nombre: string; email?: string | null; boletin?: boolean; activo?: boolean; menor?: boolean; sexo?: 'HOMBRE' | 'MUJER' }) => {
    const h = await db.hermano.create({
      data: {
        userId: familia.id, nombre: datos.nombre, apellidos: 'Prueba', poblacion: pueblo,
        fechaNacimiento: new Date(datos.menor ? '2015-01-01T00:00:00Z' : '1980-01-01T00:00:00Z'),
        email: datos.email ?? null, boletin: datos.boletin ?? false, activo: datos.activo ?? true, sexo: datos.sexo ?? null,
      },
    });
    hermanos.push(h.id);
    return h;
  };
  const crear = async (tipo: 'BOLETIN' | 'AVISO', segmento = {}) => {
    const c = await ComunicadosService.crear({ tipo, asunto: 'Cultos de octubre', cuerpo: '<p>Os esperamos.</p><script>x</script>', segmento: { poblacion: pueblo, ...segmento } }, { userId: staff.id });
    comunicados.push(c.id);
    return c;
  };
  const recoger = async () => {
    await db.comunicado.deleteMany({ where: { id: { in: comunicados } } });
    await db.recibo.deleteMany({ where: { hermanoId: { in: hermanos } } });
    await db.hermano.deleteMany({ where: { id: { in: hermanos } } });
    await db.auditLog.deleteMany({ where: { OR: [{ userId: staff.id }, { action: 'BOLETIN_BAJA', createdAt: { gte: new Date(Date.now() - 60_000) } }] } });
    await borrarUsuarioPrueba(familia.id);
    await borrarUsuarioPrueba(staff.id);
  };
  return { staff, familia, pueblo, ficha, crear, recoger };
}

test('el boletín va solo a los suscritos activos, un correo por dirección, y lo enviado ya no se toca', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    await e.ficha({ nombre: 'Ana', email: 'ana.boletin@ejemplo.test', boletin: true, sexo: 'MUJER' });
    await e.ficha({ nombre: 'Luis', boletin: true }); // sin correo propio: el de la cuenta
    await e.ficha({ nombre: 'Eva', boletin: true, menor: true }); // misma cuenta: mismo correo que Luis
    await e.ficha({ nombre: 'Pepe', email: 'pepe@ejemplo.test' }); // no suscrito
    await e.ficha({ nombre: 'Rosa', email: 'rosa@ejemplo.test', boletin: true, activo: false }); // de baja

    const c = await e.crear('BOLETIN');
    assert.ok(!c.cuerpo.includes('<script>'), 'el cuerpo se sanea al guardar');
    const cuenta = await ComunicadosService.destinatarios('BOLETIN', { poblacion: e.pueblo });
    assert.deepEqual([cuenta.fichas, cuenta.correos], [3, 2]);

    enviados.length = 0;
    const r = await ComunicadosService.enviar(c.id, { userId: e.staff.id });
    assert.equal(r.destinatarios, 2);
    await envioTerminado();
    assert.deepEqual(enviados.map((m) => m.to).sort(), ['ana.boletin@ejemplo.test', e.familia.email].sort());
    const deAna = enviados.find((m) => m.to === 'ana.boletin@ejemplo.test')!;
    assert.match(deAna.html, /Estimada Ana:/);
    assert.match(deAna.html, /boletin\/baja\?t=/);
    assert.match(enviados.find((m) => m.to !== 'ana.boletin@ejemplo.test')!.html, /Queridos hermanos:/);

    const lista = (await ComunicadosService.listar()).find((x) => x.id === c.id)!;
    assert.equal(lista.estado, 'ENVIADO');
    assert.deepEqual(lista.envios, { enviados: 2, fallidos: 0, rebotados: 0, pendientes: 0, alMovil: 0 });

    await assert.rejects(ComunicadosService.enviar(c.id, { userId: e.staff.id }), (err: unknown) => err instanceof HttpError && err.status === 409);
    await assert.rejects(ComunicadosService.actualizar(c.id, { tipo: 'BOLETIN', asunto: 'Otro', cuerpo: '<p>x</p>', segmento: {} }), (err: unknown) => err instanceof HttpError && err.status === 409);
    await assert.rejects(ComunicadosService.borrar(c.id), (err: unknown) => err instanceof HttpError && err.status === 409);
  } finally {
    await e.recoger();
  }
});

test('el aviso va a todos los activos del segmento, y los filtros se suman', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    const conDeuda = await e.ficha({ nombre: 'Ana', email: 'ana.aviso@ejemplo.test' });
    const pepe = await e.ficha({ nombre: 'Pepe', email: 'pepe.aviso@ejemplo.test' });
    await e.ficha({ nombre: 'Niño', email: 'nino.aviso@ejemplo.test', menor: true });
    await db.recibo.create({ data: { hermanoId: conDeuda.id, year: 2099, concepto: 'Cuota 2099', importe: '30', tipo: TipoRecibo.CUOTA_HERMANO } });
    // Ni un donativo pendiente ni una cuota devuelta que ya se reemitió (y pagó) son cuotas por cobrar.
    await db.recibo.create({ data: { hermanoId: pepe.id, year: 2099, concepto: 'Donativo', importe: '10', tipo: TipoRecibo.DONATIVO } });
    const devuelta = await db.recibo.create({ data: { hermanoId: pepe.id, year: 2098, concepto: 'Cuota 2098', importe: '30', tipo: TipoRecibo.CUOTA_HERMANO, estado: EstadoPago.DEVUELTO } });
    // La reemisión apunta a su devuelta (NG1): es el enlace lo que la da por reemitida.
    await db.recibo.create({ data: { hermanoId: pepe.id, year: 2098, concepto: 'Cuota 2098 (reemisión)', importe: '30', tipo: TipoRecibo.CUOTA_HERMANO, estado: EstadoPago.PAGADO, reemisionDeId: devuelta.id } });

    assert.equal((await ComunicadosService.destinatarios('AVISO', { poblacion: e.pueblo })).correos, 3);
    assert.equal((await ComunicadosService.destinatarios('AVISO', { poblacion: e.pueblo, edad: 'MAYORES' })).correos, 2);
    assert.equal((await ComunicadosService.destinatarios('AVISO', { poblacion: e.pueblo, edad: 'MENORES' })).correos, 1);
    assert.equal((await ComunicadosService.destinatarios('AVISO', { poblacion: e.pueblo, conDeuda: true })).correos, 1);

    const c = await e.crear('AVISO', { conDeuda: true });
    enviados.length = 0;
    await ComunicadosService.enviar(c.id, { userId: e.staff.id });
    await envioTerminado();
    assert.deepEqual(enviados.map((m) => m.to), ['ana.aviso@ejemplo.test']);
    assert.ok(!enviados[0].html.includes('boletin/baja'), 'el aviso no lleva baja del boletín');
  } finally {
    await e.recoger();
  }
});

test('los fallidos se reintentan, y la prueba llega a quien la pide', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  try {
    await e.ficha({ nombre: 'Ana', email: 'ana.fallo@ejemplo.test' });
    const c = await e.crear('AVISO');

    enviados.length = 0;
    await ComunicadosService.enviarPrueba(c.id, { userId: e.staff.id });
    assert.deepEqual(enviados.map((m) => [m.to, m.subject]), [[e.staff.email, '[Prueba] Cultos de octubre']]);

    ponerTransporte({ sendMail: async () => { throw new Error('cupo agotado'); } });
    await ComunicadosService.enviar(c.id, { userId: e.staff.id });
    await envioTerminado();
    assert.deepEqual((await ComunicadosService.listar()).find((x) => x.id === c.id)!.envios, { enviados: 0, fallidos: 1, rebotados: 0, pendientes: 0, alMovil: 0 });

    enviados.length = 0;
    ponerTransporte({ sendMail: async (m) => { enviados.push(m as { to: string; subject: string; html: string }); } });
    await ComunicadosService.reintentarFallidos(c.id);
    await envioTerminado();
    assert.deepEqual(enviados.map((m) => m.to), ['ana.fallo@ejemplo.test']);
    assert.deepEqual((await ComunicadosService.listar()).find((x) => x.id === c.id)!.envios, { enviados: 1, fallidos: 0, rebotados: 0, pendientes: 0, alMovil: 0 });
  } finally {
    await e.recoger();
  }
});

// NG12: «apuntados a…» llega a quien pidió la papeleta y a quien ya la recogió.
test('«apuntados a» una salida: con la solicitud pendiente o con la papeleta de su año', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const restaurar = await encenderModulos(['agenda', 'procesion']);
  const e = await escenario();
  try {
    const pasion = await salidaDePrueba(PASION);
    const year = anioDeLaMesa(pasion);
    const pide = await e.ficha({ nombre: 'Pide', email: 'pide.apuntados@ejemplo.test' });
    const tiene = await e.ficha({ nombre: 'Tiene', email: 'tiene.apuntados@ejemplo.test' });
    const cancelo = await e.ficha({ nombre: 'Cancela', email: 'cancela.apuntados@ejemplo.test' });
    const otroAnio = await e.ficha({ nombre: 'Antes', email: 'antes.apuntados@ejemplo.test' });
    await e.ficha({ nombre: 'Nada', email: 'nada.apuntados@ejemplo.test' });
    const solicitud = (hermanoId: number, estado: EstadoSolicitud, y = year) =>
      db.solicitud.create({ data: { hermanoId, salidaId: pasion.id, year: y, puesto: 'Nazareno', origen: OrigenSolicitud.WEB, estado } });
    await solicitud(pide.id, EstadoSolicitud.PENDIENTE);
    await solicitud(cancelo.id, EstadoSolicitud.CANCELADA);
    await solicitud(otroAnio.id, EstadoSolicitud.PENDIENTE, year - 1);
    const recibo = await db.recibo.create({ data: { hermanoId: tiene.id, year, concepto: 'Papeleta', importe: '0', tipo: TipoRecibo.PAPELETA_SITIO, estado: EstadoPago.PAGADO } });
    await db.papeletaSitio.create({ data: { hermanoId: tiene.id, salidaId: pasion.id, year, puesto: 'Nazareno', reciboId: recibo.id } });

    const r = await ComunicadosService.destinatarios('AVISO', { poblacion: e.pueblo, apuntadosA: pasion.id });
    assert.equal(r.fichas, 2);
    const c = await e.crear('AVISO', { apuntadosA: pasion.id });
    assert.match(c.para, literal(`apuntados ${await aLaSalida(PASION)}`));
  } finally {
    await db.solicitud.deleteMany({ where: { hermano: { poblacion: e.pueblo } } });
    await db.papeletaSitio.deleteMany({ where: { hermano: { poblacion: e.pueblo } } });
    await e.recoger();
    await restaurar();
  }
});

test('la baja del boletín desde el enlace, sin sesión y con el módulo apagado; con el enlace cambiado, no', async (t) => {
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const e = await escenario();
  const antes = await db.modulo.findUnique({ where: { clave: 'comunicados' }, select: { activo: true } });
  try {
    const ana = await e.ficha({ nombre: 'Ana', email: 'ana.baja@ejemplo.test', boletin: true });
    // El boletín ya está en los buzones cuando se apaga el módulo: el enlace tiene que seguir valiendo.
    await db.modulo.updateMany({ where: { clave: 'comunicados' }, data: { activo: false } });
    await ModulosService.cargar();
    const res = await fetch(`${baseUrl}/api/boletin/baja`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenDeBaja('ana.baja@ejemplo.test', process.env.JWT_SECRET!) }),
    });
    assert.equal(res.status, 200);
    assert.equal((await db.hermano.findUniqueOrThrow({ where: { id: ana.id } })).boletin, false);

    const mal = await fetch(`${baseUrl}/api/boletin/baja`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'abc.def' }) });
    assert.equal(mal.status, 400);
  } finally {
    if (antes) await db.modulo.updateMany({ where: { clave: 'comunicados' }, data: { activo: antes.activo } });
    await ModulosService.cargar();
    await e.recoger();
  }
});

test('el resto de rutas piden sesión de quien lleva la comunicación', async (t) => {
  assert.equal((await fetch(`${baseUrl}/api/comunicados`)).status, 401);
  if (!dbDisponible) { t.skip(SIN_DB); return; }
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  try {
    assert.equal((await fetch(`${baseUrl}/api/comunicados`, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(tesorero.id, Role.TESORERIA)}` } })).status, 403);
  } finally {
    await borrarUsuarioPrueba(tesorero.id);
  }
});
