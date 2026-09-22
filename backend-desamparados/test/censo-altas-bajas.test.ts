// Altas, bajas y auditoría del censo (hallazgos D1, D17, D19, P2, P3, P4 y S10
// de la auditoría del 11-09-2026).
//
// La edición genérica de la ficha activaba solicitudes sin aprobarlas y dejaba
// a gente de baja pero activa; las altas y bajas se registraban en la auditoría
// antes de hacerse; dos aprobaciones a la vez chocaban por el número de
// hermano. Estas pruebas van contra la base de desarrollo con filas
// desechables, que se borran al terminar (con sus apuntes de auditoría).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { HttpError } from '../src/utils/error.handle.js';
import { esCuentaAnonimizada } from '../src/domain/cuenta-anonimizada.js';
import { diferenciasFicha, valorParaAuditoria } from '../src/domain/cambios-ficha.js';
import { normalizarValorConfiguracion } from '../src/domain/configuracion.js';
import { diaDeHoy } from '../src/domain/fechas-hermano.js';
import { diaMadrid } from '../src/domain/contabilidad.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { MisDatosService } from '../src/services/mis-datos.service.js';
import { SolicitudesService } from '../src/services/solicitudes.service.js';
import { MisFichasService } from '../src/services/mis-fichas.service.js';
import { CensoService } from '../src/services/censo.service.js';

let server: Server;
let baseUrl: string;
let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

const creados = { usuarios: [] as number[], hermanos: [] as number[] };
let secretaria: { id: number };
let admin: { id: number };
// Valor de la configuración que toca una prueba, para dejarlo como estaba.
let precioOriginal: { value: string; descripcion: string | null } | null | undefined;

// Un sufijo por ejecución: los apellidos de prueba no chocan con los de otra.
const RONDA = Date.now().toString(36);
let contador = 0;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try { await db.$queryRaw`SELECT 1`; dbDisponible = true; } catch { dbDisponible = false; }
  if (!dbDisponible) return;

  secretaria = await crearUsuarioPrueba(Role.SECRETARIA);
  admin = await crearUsuarioPrueba(Role.ADMIN);
  creados.usuarios.push(secretaria.id, admin.id);
});

after(async () => {
  server.close();
  if (!dbDisponible) return;
  // Primero la auditoría: al borrar el usuario su userId pasa a NULL y ya no
  // se podrían encontrar los apuntes por autor.
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: creados.usuarios } },
        { entityType: 'hermano', entityId: { in: creados.hermanos.map(String) } },
        { entityType: 'user', entityId: { in: creados.usuarios.map(String) } },
      ],
    },
  });
  // Los recibos de prueba primero: cuelgan de la ficha.
  await db.recibo.deleteMany({ where: { hermanoId: { in: creados.hermanos } } });
  await db.hermano.deleteMany({ where: { id: { in: creados.hermanos } } });
  for (const id of creados.usuarios) await borrarUsuarioPrueba(id);
  if (precioOriginal === null) {
    await db.configuracion.deleteMany({ where: { key: 'precio_alquiler_tunica' } });
  } else if (precioOriginal) {
    await db.configuracion.update({ where: { key: 'precio_alquiler_tunica' }, data: { value: precioOriginal.value } });
  }
  await db.$disconnect();
});

const meta = () => ({ userId: secretaria.id });

const como = (usuario: { id: number }, rol: Role, ruta: string, init: RequestInit & { json?: unknown } = {}) => {
  const { json, ...resto } = init;
  return fetch(`${baseUrl}${ruta}`, {
    ...resto,
    headers: {
      Cookie: `${COOKIE_CMS}=${generateToken(usuario.id, rol)}`,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
};

/** Una cuenta de hermano raso desechable; `active` como la de una solicitud o no. */
async function cuenta(active = true) {
  const usuario = await crearUsuarioPrueba(Role.USER);
  creados.usuarios.push(usuario.id);
  if (!active) await db.user.update({ where: { id: usuario.id }, data: { active: false } });
  return usuario;
}

async function ficha(userId: number, datos: Record<string, unknown> = {}) {
  contador += 1;
  const creada = await db.hermano.create({
    data: {
      userId, nombre: 'Prueba', apellidos: `Censo ${RONDA} ${contador}`,
      fechaNacimiento: new Date('1990-01-01'), fechaAlta: new Date('2020-03-15'),
      activo: false, esTitular: true, ...datos,
    },
  });
  creados.hermanos.push(creada.id);
  return creada;
}

/** Cuenta nueva sin aprobar con su ficha pendiente: una solicitud de alta. */
async function solicitudPendiente() {
  const usuario = await cuenta(false);
  const pendiente = await ficha(usuario.id);
  return { usuario, ficha: pendiente };
}

/**
 * Un hermano de alta de verdad: se crea la solicitud y se aprueba. La
 * aprobación pone el alta de hoy; se retrasa a 2020 para que las bajas de
 * prueba con fecha pasada no queden «anteriores al alta».
 */
async function hermanoActivo() {
  const { usuario, ficha: f } = await solicitudPendiente();
  await SolicitudesService.aprobarSolicitud(usuario.id, meta());
  const aprobada = await db.hermano.update({ where: { id: f.id }, data: { fechaAlta: new Date('2020-03-15') } });
  return { usuario, ficha: aprobada };
}

/** Un hermano ya de baja, dado de baja por secretaría. */
async function hermanoDeBaja(fechaBaja = '2024-05-10') {
  const { usuario, ficha: f } = await hermanoActivo();
  await CensoService.darDeBajaHermano(f.id, meta(), fechaBaja);
  return { usuario, ficha: (await db.hermano.findUnique({ where: { id: f.id } }))! };
}

const apuntes = (action: string, entityType: string, entityId: number) =>
  db.auditLog.findMany({ where: { action, entityType, entityId: String(entityId) }, orderBy: { id: 'asc' } });

// =====================================================================
describe('la ficha no da altas ni bajas (D1)', () => {
  test('corregir una errata en una solicitud pendiente no la activa', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: pendiente } = await solicitudPendiente();

    // Un cliente viejo que siga mandando `activo: true` no cambia nada.
    const res = await como(secretaria, Role.SECRETARIA, `/api/hermanos/admin/${pendiente.id}`, {
      method: 'PUT', json: { nombre: 'Corregido', activo: true },
    });
    assert.equal(res.status, 200);

    const despues = await db.hermano.findUnique({ where: { id: pendiente.id } });
    assert.equal(despues!.nombre, 'Corregido');
    assert.equal(despues!.activo, false, 'sigue pendiente: solo «Aprobar» la activa');
    assert.equal(despues!.numeroHermano, null);
    assert.equal(despues!.fechaBaja, null);
    const cuentaDespues = await db.user.findUnique({ where: { id: usuario.id } });
    assert.equal(cuentaDespues!.active, false);
  });

  test('quitar la baja por la ficha (null) ya no se acepta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: deBaja } = await hermanoDeBaja();
    const res = await como(secretaria, Role.SECRETARIA, `/api/hermanos/admin/${deBaja.id}`, {
      method: 'PUT', json: { fechaBaja: null },
    });
    assert.equal(res.status, 400);
    const despues = await db.hermano.findUnique({ where: { id: deBaja.id } });
    assert.equal(despues!.activo, false);
  });

  test('poner fecha de baja a una ficha activa se rechaza: para eso está «Dar de baja»', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();
    await assert.rejects(
      () => CensoService.updateAdminMode(activa.id, { fechaBaja: '2025-01-01' }, meta()),
      /Dar de baja/,
    );
    const despues = await db.hermano.findUnique({ where: { id: activa.id } });
    assert.equal(despues!.activo, true);
    assert.equal(despues!.fechaBaja, null);
  });

  test('tampoco a una solicitud pendiente', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: pendiente } = await solicitudPendiente();
    await assert.rejects(() => CensoService.updateAdminMode(pendiente.id, { fechaBaja: '2025-01-01' }, meta()), /Dar de baja/);
  });

  test('en una ficha de baja la fecha se corrige, pero nunca antes del alta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: deBaja } = await hermanoDeBaja();
    const alta = diaMadrid(deBaja.fechaAlta);

    await CensoService.updateAdminMode(deBaja.id, { fechaBaja: alta }, meta());
    const corregida = await db.hermano.findUnique({ where: { id: deBaja.id } });
    assert.equal(diaMadrid(corregida!.fechaBaja!), alta);
    assert.equal(corregida!.activo, false);

    await assert.rejects(() => CensoService.updateAdminMode(deBaja.id, { fechaBaja: '2000-01-01' }, meta()), /anterior/);
  });

  test('mover el alta después de una baja existente se rechaza', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: deBaja } = await hermanoDeBaja('2024-05-10');
    // Alta de 2020 y baja de 2024: llevar el alta a 2025 la dejaría después de la baja.
    await assert.rejects(() => CensoService.updateAdminMode(deBaja.id, { fechaAlta: '2025-06-01' }, meta()), /anterior/);
  });

  // --- Fechas en día de Madrid (revisión del 11-09-2026) ---
  // Un alta aprobada a las 00:30 de Málaga son las 22:30 UTC del día anterior.
  // Antes, guardar cualquier otro campo reescribía el alta como medianoche UTC
  // del día UTC: la movía al día anterior sin rastro en la auditoría.
  test('guardar la ficha no mueve un alta de madrugada al día anterior', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();
    const altaDeMadrugada = new Date('2026-09-11T22:30:00Z'); // 00:30 del 12 en Madrid
    await db.hermano.update({ where: { id: activa.id }, data: { fechaAlta: altaDeMadrugada } });

    // Lo que manda el formulario: la ficha entera, con el alta como su día de Madrid.
    await CensoService.updateAdminMode(activa.id, { nombre: 'Corregido', fechaAlta: '2026-09-12' }, meta());

    const despues = await db.hermano.findUnique({ where: { id: activa.id } });
    assert.equal(despues!.fechaAlta.getTime(), altaDeMadrugada.getTime(), 'el alta no se reescribe si no cambia de día');
    const [apunte] = await apuntes('HERMANO_ACTUALIZAR', 'hermano', activa.id);
    assert.deepEqual(Object.keys((apunte.detalles as { despues: object }).despues), ['nombre']);
  });

  test('cambiar el alta a su día UTC sí es un cambio, y queda en la auditoría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();
    await db.hermano.update({ where: { id: activa.id }, data: { fechaAlta: new Date('2026-09-11T22:30:00Z') } });

    await CensoService.updateAdminMode(activa.id, { fechaAlta: '2026-09-11' }, meta());

    const despues = await db.hermano.findUnique({ where: { id: activa.id } });
    assert.equal(diaMadrid(despues!.fechaAlta), '2026-09-11');
    const [apunte] = await apuntes('HERMANO_ACTUALIZAR', 'hermano', activa.id);
    assert.deepEqual(apunte.detalles, { antes: { fechaAlta: '2026-09-12' }, despues: { fechaAlta: '2026-09-11' } });
  });

  test('una baja del día 1 de madrugada no cambia de mes al guardar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: deBaja } = await hermanoDeBaja();
    const bajaDeMadrugada = new Date('2026-02-28T23:30:00Z'); // 00:30 del 1 de marzo en Madrid
    await db.hermano.update({ where: { id: deBaja.id }, data: { fechaBaja: bajaDeMadrugada } });

    await CensoService.updateAdminMode(deBaja.id, { puesto: 'Cirio', fechaBaja: '2026-03-01' }, meta());

    const despues = await db.hermano.findUnique({ where: { id: deBaja.id } });
    assert.equal(despues!.fechaBaja!.getTime(), bajaDeMadrugada.getTime());
    assert.equal(diaMadrid(despues!.fechaBaja!), '2026-03-01');
  });

  test('las fechas se auditan y se guardan en día de Madrid', () => {
    assert.equal(valorParaAuditoria(new Date('2026-02-28T23:30:00Z')), '2026-03-01');
    // Un nacimiento guardado como medianoche UTC sigue siendo su mismo día.
    assert.equal(valorParaAuditoria(new Date('1990-01-01T00:00:00Z')), '1990-01-01');
  });

  // --- Edición condicionada (revisión del 11-09-2026) ---
  test('corregir la baja mientras otro reactiva no deja una ficha activa con fecha de baja', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: deBaja } = await hermanoDeBaja('2024-05-10');

    // Otra transacción reactiva la ficha y tarda en confirmar: la edición lee la
    // ficha aún de baja, pero cuando va a escribir ya no lo está.
    //
    // El orden se espera de verdad, no con un `setTimeout` a ojo: con la suite
    // entera en paralelo, la reactivación podía no haber escrito aún a los
    // 100 ms; entonces `soltar` no existía, el test fallaba y la transacción se
    // quedaba abierta con la fila bloqueada, y la limpieza del final esperaba
    // ese bloqueo para siempre (la suite colgada). Por eso también se suelta
    // siempre, en el `finally`.
    let soltar: (() => void) | undefined;
    let avisarEscrita!: () => void;
    const escrita = new Promise<void>((r) => { avisarEscrita = r; });
    const reactivacion = db.$transaction(async (tx) => {
      await tx.hermano.update({ where: { id: deBaja.id }, data: { activo: true, fechaBaja: null } });
      await new Promise<void>((r) => { soltar = r; avisarEscrita(); });
    }, { timeout: 10_000 });

    let edicion: Promise<unknown> | undefined;
    try {
      await Promise.race([
        escrita,
        new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('la reactivación no llegó a escribir en 5 s')), 5000).unref())
      ]);
      edicion = CensoService.updateAdminMode(deBaja.id, { fechaBaja: '2024-06-01' }, meta());
      // Da tiempo a que la edición lea y se quede esperando el bloqueo de la
      // fila. Si tardara más, leería ya la ficha activa: también es un error de
      // negocio, que es lo que se comprueba.
      await new Promise((r) => setTimeout(r, 150));
    } finally {
      soltar?.();
      await reactivacion;
    }

    await assert.rejects(edicion!, (e: unknown) => e instanceof HttpError, 'la edición tiene que fallar con un error de negocio');
    const despues = await db.hermano.findUnique({ where: { id: deBaja.id } });
    assert.equal(despues!.activo, true);
    assert.equal(despues!.fechaBaja, null, 'nunca activa y con fecha de baja a la vez');
  });

  test('el número no se pone a mano en una ficha pendiente', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: pendiente } = await solicitudPendiente();
    await assert.rejects(() => CensoService.updateAdminMode(pendiente.id, { numeroHermano: 99999 }, meta()), /fichas activas/);
  });
});

// =====================================================================
describe('dar de baja y reactivar', () => {
  test('la baja con fecha libera el número, bloquea la cuenta y lo anota después', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: activa } = await hermanoActivo();
    assert.ok(activa.numeroHermano, 'la aprobación debería haberle dado número');

    await CensoService.darDeBajaHermano(activa.id, meta(), '2026-01-20');

    const despues = await db.hermano.findUnique({ where: { id: activa.id } });
    assert.equal(despues!.activo, false);
    assert.equal(despues!.numeroHermano, null);
    assert.equal(diaMadrid(despues!.fechaBaja!), '2026-01-20');
    assert.equal((await db.user.findUnique({ where: { id: usuario.id } }))!.active, false);

    const [apunte] = await apuntes('HERMANO_BAJA', 'hermano', activa.id);
    assert.ok(apunte, 'la baja debería quedar en la auditoría');
    const detalles = apunte.detalles as { antes: Record<string, unknown>; despues: Record<string, unknown> };
    assert.equal(detalles.antes.numeroHermano, activa.numeroHermano, 'el número que tenía queda en el registro');
    assert.equal(detalles.despues.fechaBaja, '2026-01-20');
    assert.equal(detalles.despues.cuentaActiva, false);
  });

  test('una solicitud pendiente no se da de baja: se rechaza desde Solicitudes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: pendiente } = await solicitudPendiente();
    await assert.rejects(() => CensoService.darDeBajaHermano(pendiente.id, meta()), /Solicitudes/);
  });

  test('una baja con fecha futura se rechaza', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();
    await assert.rejects(() => CensoService.darDeBajaHermano(activa.id, meta(), '2099-01-01'), /posterior a hoy/);
    assert.equal((await db.hermano.findUnique({ where: { id: activa.id } }))!.activo, true);
  });

  test('la ruta de baja acepta el DELETE sin cuerpo y rechaza una fecha mal escrita', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();

    const mala = await como(secretaria, Role.SECRETARIA, `/api/hermanos/admin/${activa.id}/baja`, { method: 'DELETE', json: { fechaBaja: '20-01-2026' } });
    assert.equal(mala.status, 400);

    const buena = await como(secretaria, Role.SECRETARIA, `/api/hermanos/admin/${activa.id}/baja`, { method: 'DELETE' });
    assert.equal(buena.status, 200);
    const despues = await db.hermano.findUnique({ where: { id: activa.id } });
    assert.equal(diaMadrid(despues!.fechaBaja!) <= diaDeHoy(), true);
  });

  test('«Reactivar» no aprueba solicitudes pendientes', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: pendiente } = await solicitudPendiente();
    await assert.rejects(() => CensoService.reactivarHermano(pendiente.id, meta()), /Solicitudes/);

    const despues = await db.hermano.findUnique({ where: { id: pendiente.id } });
    assert.equal(despues!.activo, false);
    assert.equal(despues!.numeroHermano, null);
    assert.equal((await db.user.findUnique({ where: { id: usuario.id } }))!.active, false);
  });

  test('reactivar da número nuevo, alta de hoy y devuelve el acceso', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: deBaja } = await hermanoDeBaja();

    await CensoService.reactivarHermano(deBaja.id, meta());

    const despues = await db.hermano.findUnique({ where: { id: deBaja.id } });
    assert.equal(despues!.activo, true);
    assert.equal(despues!.fechaBaja, null);
    assert.ok(despues!.numeroHermano);
    assert.equal((await db.user.findUnique({ where: { id: usuario.id } }))!.active, true);

    const [apunte] = await apuntes('HERMANO_REACTIVAR', 'hermano', deBaja.id);
    const detalles = apunte.detalles as { antes: Record<string, unknown>; despues: Record<string, unknown> };
    assert.equal(detalles.antes.fechaBaja, '2024-05-10');
    assert.equal(detalles.despues.numeroHermano, despues!.numeroHermano);
  });

  // --- P3 ---
  test('reactivar a quien borró su cuenta (RGPD) devuelve la ficha al censo pero no la cuenta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const usuario = await cuenta(false);
    // Así deja MisDatosService.deleteOwnAccount una cuenta suprimida.
    await db.user.update({ where: { id: usuario.id }, data: { email: `anon-${usuario.id}@eliminado.local`, dni: `ELIMINADO-${usuario.id}` } });
    const suprimida = await ficha(usuario.id, { activo: false, fechaBaja: new Date('2025-02-01') });

    const { message } = await CensoService.reactivarHermano(suprimida.id, meta());

    assert.match(message, /RGPD/);
    const despues = await db.hermano.findUnique({ where: { id: suprimida.id } });
    assert.equal(despues!.activo, true);
    assert.ok(despues!.numeroHermano);
    assert.equal((await db.user.findUnique({ where: { id: usuario.id } }))!.active, false, 'la cuenta anonimizada sigue cerrada');
  });

  test('una cuenta se reconoce como anonimizada por su correo o su DNI', () => {
    assert.equal(esCuentaAnonimizada({ email: 'anon-7@eliminado.local', dni: 'ELIMINADO-7' }), true);
    assert.equal(esCuentaAnonimizada({ email: 'rocio@ejemplo.es', dni: 'ELIMINADO-7' }), true);
    assert.equal(esCuentaAnonimizada({ email: 'rocio@ejemplo.es', dni: '20000001R' }), false);
  });
});

// =====================================================================
describe('aprobación de solicitudes (D17 y doble clic)', () => {
  test('cuatro aprobaciones a la vez no chocan por el número de hermano', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const solicitudes = await Promise.all([1, 2, 3, 4].map(() => solicitudPendiente()));

    const resultados = await Promise.allSettled(solicitudes.map((s) => SolicitudesService.aprobarSolicitud(s.usuario.id, meta())));
    const fallos = resultados.filter((r) => r.status === 'rejected');
    assert.equal(fallos.length, 0, `fallaron ${fallos.length}: ${fallos.map((f) => String((f as PromiseRejectedResult).reason)).join(' | ')}`);

    const fichas = await db.hermano.findMany({ where: { id: { in: solicitudes.map((s) => s.ficha.id) } } });
    const numeros = fichas.map((f) => f.numeroHermano);
    assert.ok(numeros.every((n) => typeof n === 'number'));
    assert.equal(new Set(numeros).size, 4, 'cada ficha con su propio número');
  });

  test('dos clics seguidos en «Aprobar» numeran la ficha una sola vez', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: pendiente } = await solicitudPendiente();

    const [a, b] = await Promise.allSettled([
      SolicitudesService.aprobarSolicitud(usuario.id, meta()),
      SolicitudesService.aprobarSolicitud(usuario.id, meta()),
    ]);
    const bien = [a, b].filter((r) => r.status === 'fulfilled');
    const mal = [a, b].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    assert.equal(bien.length, 1, 'una de las dos aprueba');
    assert.equal(mal.length, 1, 'la otra se rechaza');
    assert.ok(mal[0].reason instanceof HttpError, `la segunda debería ser un error de negocio, no ${mal[0].reason}`);

    const despues = await db.hermano.findUnique({ where: { id: pendiente.id } });
    assert.equal(despues!.activo, true);
    assert.equal((await apuntes('SOLICITUD_APROBAR', 'user', usuario.id)).length, 1, 'un solo apunte de aprobación');
  });

  test('dos clics seguidos en «Dar de baja» o «Reactivar» no dan un 500', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // MariaDB 11.8 (innodb_snapshot_isolation) rechaza con el error 1020 la
    // escritura de una fila que otra transacción cambió: sin reintento, la
    // segunda petición era un error crudo de la base de datos.
    const { ficha: activa } = await hermanoActivo();
    const bajas = await Promise.allSettled([
      CensoService.darDeBajaHermano(activa.id, meta()),
      CensoService.darDeBajaHermano(activa.id, meta()),
    ]);
    assert.equal(bajas.filter((r) => r.status === 'fulfilled').length, 1);
    const falloBaja = bajas.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(falloBaja.reason instanceof HttpError, `baja: ${falloBaja.reason}`);

    const altas = await Promise.allSettled([
      CensoService.reactivarHermano(activa.id, meta()),
      CensoService.reactivarHermano(activa.id, meta()),
    ]);
    assert.equal(altas.filter((r) => r.status === 'fulfilled').length, 1);
    const falloAlta = altas.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(falloAlta.reason instanceof HttpError, `reactivar: ${falloAlta.reason}`);
    assert.equal((await apuntes('HERMANO_REACTIVAR', 'hermano', activa.id)).length, 1);
  });

  test('una aprobación que no se hace no deja constancia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario } = await hermanoActivo(); // ya aprobada: no queda nada pendiente
    const antes = (await apuntes('SOLICITUD_APROBAR', 'user', usuario.id)).length;
    await assert.rejects(() => SolicitudesService.aprobarSolicitud(usuario.id, meta()));
    assert.equal((await apuntes('SOLICITUD_APROBAR', 'user', usuario.id)).length, antes);
  });
});

// =====================================================================
describe('auditoría de la ficha (D19)', () => {
  test('editar la ficha anota solo los campos que cambian, con el valor anterior', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();

    // El CMS manda la ficha entera: nombre y apellidos van iguales.
    await CensoService.updateAdminMode(activa.id, {
      nombre: activa.nombre, apellidos: activa.apellidos, fechaNacimiento: '1991-02-03', puesto: 'Nazareno de cirio',
    }, meta());

    const [apunte] = await apuntes('HERMANO_ACTUALIZAR', 'hermano', activa.id);
    assert.ok(apunte);
    assert.equal(apunte.userId, secretaria.id);
    assert.deepEqual(apunte.detalles, {
      antes: { fechaNacimiento: '1990-01-01', puesto: null },
      despues: { fechaNacimiento: '1991-02-03', puesto: 'Nazareno de cirio' },
    });
  });

  test('guardar sin cambios no llena la auditoría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();
    await CensoService.updateAdminMode(activa.id, { nombre: activa.nombre }, meta());
    assert.equal((await apuntes('HERMANO_ACTUALIZAR', 'hermano', activa.id)).length, 0);
  });

  test('rechazar una solicitud se anota después y sin datos personales', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: pendiente } = await solicitudPendiente();

    await SolicitudesService.rechazarSolicitud(usuario.id, meta());

    const [apunte] = await apuntes('SOLICITUD_RECHAZAR', 'user', usuario.id);
    assert.ok(apunte);
    const texto = JSON.stringify(apunte.detalles);
    assert.ok(!texto.includes(pendiente.apellidos), 'guardar el nombre desharía el borrado');
    assert.deepEqual((apunte.detalles as { despues: unknown }).despues, { cuentaEliminada: true, fichasEliminadas: [pendiente.id] });
  });

  test('rechazar el familiar pendiente de una cuenta bloqueada con historia no borra la cuenta', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Cuenta bloqueada porque su única ficha causó baja, con un familiar aún
    // pendiente: no es «una cuenta nunca aprobada» y tiene historia en el censo.
    const usuario = await cuenta(false);
    const historica = await ficha(usuario.id, { activo: false, fechaBaja: new Date('2024-01-01') });
    const pendiente = await ficha(usuario.id);

    await SolicitudesService.rechazarSolicitud(usuario.id, meta());

    assert.ok(await db.user.findUnique({ where: { id: usuario.id } }), 'la cuenta sigue');
    assert.ok(await db.hermano.findUnique({ where: { id: historica.id } }), 'la ficha histórica sigue');
    assert.equal(await db.hermano.findUnique({ where: { id: pendiente.id } }), null, 'la pendiente se borra');
  });

  test('la baja familiar se anota y libera el número, como la de secretaría', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: activa } = await hermanoActivo();

    await MisFichasService.deleteProfileIfOwned(activa.id, usuario.id, { userId: usuario.id });

    const despues = await db.hermano.findUnique({ where: { id: activa.id } });
    assert.equal(despues!.numeroHermano, null);
    const [apunte] = await apuntes('HERMANO_BAJA_FAMILIAR', 'hermano', activa.id);
    assert.ok(apunte);
    assert.equal((apunte.detalles as { antes: { numeroHermano: number } }).antes.numeroHermano, activa.numeroHermano);

    // Y una segunda baja no reescribe la fecha de la primera.
    await assert.rejects(() => MisFichasService.deleteProfileIfOwned(activa.id, usuario.id), /ya está dado de baja/);
  });

  test('la familia retira una solicitud pendiente: se borra, no se da de baja', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Un hermano ya aprobado añade a un familiar y luego se arrepiente. Con una
    // fecha de baja, el panel la contaba como alta y como baja a la vez.
    const { usuario, ficha: activa } = await hermanoActivo();
    const familiar = await ficha(usuario.id);

    const { message } = (await MisFichasService.deleteProfileIfOwned(familiar.id, usuario.id, { userId: usuario.id }))!;

    assert.match(message, /retirada/i);
    assert.equal(await db.hermano.findUnique({ where: { id: familiar.id } }), null, 'la solicitud se borra');
    assert.equal((await db.hermano.findUnique({ where: { id: activa.id } }))!.activo, true, 'el resto de la familia no se toca');
    assert.equal((await db.user.findUnique({ where: { id: usuario.id } }))!.active, true, 'la cuenta sigue con acceso');
    assert.equal((await apuntes('FAMILIAR_SOLICITUD_RETIRAR', 'hermano', familiar.id)).length, 1);
    assert.equal((await apuntes('HERMANO_BAJA_FAMILIAR', 'hermano', familiar.id)).length, 0);
  });

  test('una solicitud pendiente con historial no se borra: se da de baja', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario } = await hermanoActivo();
    const familiar = await ficha(usuario.id);
    await db.recibo.create({ data: { hermanoId: familiar.id, year: 2026, concepto: `Prueba ${RONDA}`, importe: 10 } });

    await MisFichasService.deleteProfileIfOwned(familiar.id, usuario.id, { userId: usuario.id });

    const despues = await db.hermano.findUnique({ where: { id: familiar.id } });
    assert.ok(despues, 'con recibos, la ficha se conserva');
    assert.ok(despues!.fechaBaja);
    assert.equal((await apuntes('HERMANO_BAJA_FAMILIAR', 'hermano', familiar.id)).length, 1);
  });

  test('los datos bancarios nunca van en claro a la auditoría', () => {
    const detalles = diferenciasFicha(
      { iban: 'ES7921000813610123456789', nombre: 'Rocío' },
      { iban: 'ES9121000418450200051332', nombre: 'Rocío' },
    );
    assert.deepEqual(detalles, { antes: {}, despues: { iban: 'cambiado' } });
    assert.ok(!JSON.stringify(detalles).includes('ES79'));
  });
});

// =====================================================================
describe('el censo no enseña datos bancarios (P2)', () => {
  test('ni el buscador ni el listado completo devuelven IBAN, titular ni forma de pago', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { ficha: activa } = await hermanoActivo();
    // Un apellido que solo tiene esta ficha: «Censo <ronda> 1» también casaría con la 10, la 11...
    const apellidos = `Bancario ${RONDA}`;
    await db.hermano.update({ where: { id: activa.id }, data: { apellidos, iban: 'ES7921000813610123456789', titularCuenta: 'Prueba Censo' } });

    const res = await como(secretaria, Role.SECRETARIA, `/api/hermanos/admin/search?q=${encodeURIComponent(apellidos)}`);
    assert.equal(res.status, 200);
    const { data } = await res.json() as { data: Record<string, unknown>[] };
    assert.equal(data.length, 1);
    for (const campo of ['iban', 'titularCuenta', 'formaPagoPref']) assert.ok(!(campo in data[0]), `el buscador devuelve ${campo}`);

    const todos = await CensoService.getAllHermanos({ limit: 5 });
    for (const fila of todos.data as Record<string, unknown>[]) {
      assert.ok(!('iban' in fila) && !('titularCuenta' in fila) && !('formaPagoPref' in fila));
    }
  });
});

// =====================================================================
describe('la ficha del censo trae la cuenta entera', () => {
  test('enseña las otras fichas de la cuenta con su parentesco, y no la propia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { usuario, ficha: titular } = await hermanoActivo();
    const sobrino = await ficha(usuario.id, { esTitular: false, parentesco: 'SOBRINO', fechaNacimiento: new Date('2014-06-01') });

    const res = await como(secretaria, Role.SECRETARIA, `/api/hermanos/admin/${titular.id}`);
    assert.equal(res.status, 200);
    const { user } = await res.json() as { user: { hermanos: { id: number; parentesco: string | null }[] } };
    assert.deepEqual(user.hermanos.map((h) => [h.id, h.parentesco]), [[sobrino.id, 'SOBRINO']]);
    for (const h of user.hermanos) assert.ok(!('iban' in h) && !('dni' in h), 'la ficha de al lado sale con lo justo');
  });
});

// =====================================================================
describe('configuración y consultas de administración (P4 y S10)', () => {
  test('cada clave valida su valor', () => {
    assert.deepEqual(normalizarValorConfiguracion('precio_papeleta_sitio', '12,5'), { ok: true, valor: '12.5' });
    assert.deepEqual(normalizarValorConfiguracion('precio_alquiler_tunica', ' 030,50 '), { ok: true, valor: '30.50' });
    assert.deepEqual(normalizarValorConfiguracion('precio_alquiler_tunica', '0'), { ok: true, valor: '0' });
    // El mismo formato que lee procesion.service.ts: hasta ocho cifras enteras.
    assert.deepEqual(normalizarValorConfiguracion('precio_papeleta_sitio', '12345678,99'), { ok: true, valor: '12345678.99' });
    for (const malo of ['12,555', '-1', '30€', 'treinta', '', '1e3', '12.', '123456789']) {
      assert.equal(normalizarValorConfiguracion('precio_papeleta_sitio', malo).ok, false, `«${malo}» debería rechazarse`);
    }
    // Los datos de la salida van al correo de la papeleta: texto corto y sin etiquetas.
    assert.deepEqual(normalizarValorConfiguracion('procesion_hora', ' 19:30 '), { ok: true, valor: '19:30' });
    assert.deepEqual(normalizarValorConfiguracion('procesion_acceso', 'Puerta lateral, calle Victoria'), { ok: true, valor: 'Puerta lateral, calle Victoria' });
    for (const malo of ['', '   ', '<b>Jueves</b>', 'x'.repeat(121), 'línea\notra']) {
      assert.equal(normalizarValorConfiguracion('procesion_fecha', malo).ok, false, `«${malo}» debería rechazarse`);
    }
  });

  test('la ruta rechaza el número de noticias de la portada, que ya no es un ajuste, y un precio con tres decimales', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    // Son tres fijas (NOTICIAS_EN_PORTADA): guardar otro número no cambiaría nada en la web.
    const limite = await como(admin, Role.ADMIN, '/api/admin/config', { method: 'POST', json: { key: 'home_news_limit', value: '5' } });
    assert.equal(limite.status, 400);
    const precio = await como(admin, Role.ADMIN, '/api/admin/config', { method: 'POST', json: { key: 'precio_papeleta_sitio', value: '12,555' } });
    assert.equal(precio.status, 400);
  });

  test('un precio con coma se guarda con punto', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const actual = await db.configuracion.findUnique({ where: { key: 'precio_alquiler_tunica' } });
    precioOriginal = actual ? { value: actual.value, descripcion: actual.descripcion } : null;

    const res = await como(admin, Role.ADMIN, '/api/admin/config', { method: 'POST', json: { key: 'precio_alquiler_tunica', value: '15,50' } });
    assert.equal(res.status, 200);
    const guardado = await db.configuracion.findUnique({ where: { key: 'precio_alquiler_tunica' } });
    assert.equal(guardado!.value, '15.50');
  });

  test('un parámetro repetido en el buscador de usuarios es un 400, no un 500', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const res = await como(admin, Role.ADMIN, '/api/admin/users/search?q=a&q=b');
    assert.equal(res.status, 400);
    const normal = await como(admin, Role.ADMIN, '/api/admin/users/search?q=Prueba');
    assert.equal(normal.status, 200);
  });

  test('la auditoría valida su consulta y conserva la paginación', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await como(admin, Role.ADMIN, '/api/admin/audit-logs?page=1&page=2')).status, 400);
    assert.equal((await como(admin, Role.ADMIN, '/api/admin/audit-logs?userId=abc')).status, 400);

    const res = await como(admin, Role.ADMIN, '/api/admin/audit-logs?page=2&limit=5');
    assert.equal(res.status, 200);
    const { meta: paginacion } = await res.json() as { meta: { page: number; limit: number } };
    assert.equal(paginacion.page, 2);
    assert.equal(paginacion.limit, 5);
  });
});
