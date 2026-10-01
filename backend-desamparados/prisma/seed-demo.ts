// prisma/seed-demo.ts
//
// Vuelca en la base de datos el censo de demostración: trescientos hermanos con
// cinco ejercicios de cuotas, papeletas, contabilidad, reparto y ropero. Sirve
// para ver el CMS y el panel con contenido de verdad mientras el Grupo
// Parroquial prepara sus datos.
//
// Quién decide los datos es `demo/generar.ts`, que es puro y está cubierto por
// `test/seed-demo.test.ts`. Aquí solo se escribe.
//
// DOS CAUTELAS, las dos importantes:
//
//  1. No se ejecuta en producción. `NODE_ENV=production` la salta, y
//     `SEED_DEMO=0` la salta en cualquier entorno. Trescientas personas
//     inventadas en el censo real serían un buen destrozo.
//  2. Es idempotente por la vía rápida: si el primer hermano de demostración ya
//     está, no hace nada. Así `npm run seed` se puede repetir sin duplicar ni
//     tardar de más.

import {
  EstadoCita,
  EstadoPago,
  EstadoPrenda,
  MetodoPago,
  Role,
  TipoPrenda,
  TipoRecibo,
  TipoTransaccion,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import db from '../src/config/db';
import { CLAVE_CINGULOS } from '../src/services/procesion/cingulos';
import {
  generarHermanos,
  generarPapeletas,
  generarPrendas,
  conCingulosSinDevolver,
  generarRecibos,
  generarReparto,
  generarSolicitudes,
  generarTransacciones,
} from './demo/generar';

/** Cuántos hermanos se siembran. */
const CUANTOS = 300;

/**
 * Contraseña común de las cuentas de demostración. Se hashea UNA vez y se
 * reutiliza: bcrypt tarda del orden de 100 ms por cuenta, así que hacerlo
 * trescientas veces serían treinta segundos de siembra para nada. Ninguna de
 * estas cuentas tiene rol de staff ni sirve para nada más que rellenar listas.
 */
const PASSWORD_DEMO = 'Demostracion-Local-2026';

/**
 * Por qué no se debe sembrar aquí, o null si se puede. Se comprueba antes de
 * tocar nada: el `isDev` de este proyecto es `NODE_ENV !== 'production'` y se
 * dispara solo, así que la puerta se cierra desde el otro lado.
 */
export function demostracionDesactivada(): string | null {
  if (process.env.NODE_ENV === 'production') return 'NODE_ENV=production';
  if (process.env.SEED_DEMO === '0') return 'SEED_DEMO=0';
  return null;
}

export async function sembrarDemostracion(): Promise<void> {
  const motivo = demostracionDesactivada();
  if (motivo) {
    console.log(`   (censo de demostración omitido: ${motivo})`);
    return;
  }

  const hermanos = generarHermanos(CUANTOS, new Date().getFullYear());

  const yaEstaba = await db.user.findUnique({ where: { email: hermanos[0].email } });
  if (yaEstaba) {
    console.log('   (censo de demostración ya sembrado, no se toca)');
    return;
  }

  console.log(`Sembrando censo de demostración (${CUANTOS} hermanos y su historia):`);

  // --- CUENTAS Y FICHAS ---
  const password = await hash(PASSWORD_DEMO, 10);
  await db.user.createMany({
    data: hermanos.map((h) => ({
      email: h.email,
      password,
      dni: h.dni,
      nombre: h.nombre,
      apellidos: h.apellidos,
      telefono: h.telefono,
      direccion: h.direccion,
      poblacion: h.poblacion,
      codigoPostal: h.codigoPostal,
      role: Role.USER,
      active: h.activo,
    })),
  });

  const usuarios = await db.user.findMany({
    where: { email: { in: hermanos.map((h) => h.email) } },
    select: { id: true, email: true },
  });
  const idPorEmail = new Map(usuarios.map((u) => [u.email, u.id]));

  await db.hermano.createMany({
    data: hermanos.map((h) => ({
      userId: idPorEmail.get(h.email)!,
      nombre: h.nombre,
      apellidos: h.apellidos,
      dni: h.dni,
      fechaNacimiento: h.fechaNacimiento,
      telefono: h.telefono,
      email: h.email,
      direccion: h.direccion,
      poblacion: h.poblacion,
      codigoPostal: h.codigoPostal,
      fechaAlta: h.fechaAlta,
      fechaBaja: h.fechaBaja,
      activo: h.activo,
      numeroHermano: h.numeroHermano,
      esTitular: true,
      tieneTunicaPropia: h.tieneTunicaPropia,
      tunica: h.tunica,
      alturaHombro: h.alturaHombro,
      puesto: h.puesto,
      formaPagoPref: h.formaPagoPref as MetodoPago,
      iban: h.iban,
      // Dio la cuenta al darse de alta: es la fecha de su mandato SEPA.
      fechaMandato: h.iban ? h.fechaAlta : null,
    })),
  });

  const fichas = await db.hermano.findMany({
    where: { dni: { in: hermanos.map((h) => h.dni) } },
    select: { id: true, dni: true },
  });
  const idPorDni = new Map(fichas.map((f) => [f.dni!, f.id]));
  console.log(`   ${fichas.length} hermanos con su cuenta`);

  // --- RECIBOS ---
  const anio = new Date().getFullYear();
  const recibos = generarRecibos(hermanos, anio);
  await db.recibo.createMany({
    data: recibos.map((r) => ({
      hermanoId: idPorDni.get(r.dniHermano)!,
      year: r.year,
      concepto: r.concepto,
      importe: r.importe,
      tipo: r.tipo as TipoRecibo,
      estado: r.estado as EstadoPago,
      fechaEmision: r.fechaEmision,
      fechaPago: r.fechaPago,
      metodoPago: r.metodoPago as MetodoPago | null,
    })),
  });

  const recibosCreados = await db.recibo.findMany({
    where: { hermanoId: { in: [...idPorDni.values()] } },
    select: { id: true, hermanoId: true, year: true, concepto: true },
  });
  const dniPorId = new Map([...idPorDni].map(([dni, id]) => [id, dni]));
  const idPorClaveRecibo = new Map(
    recibosCreados.map((r) => [`${dniPorId.get(r.hermanoId)}|${r.year}|${r.concepto}`, r.id]),
  );
  console.log(`   ${recibosCreados.length} recibos de cinco ejercicios`);

  // --- CONTABILIDAD ---
  const categorias = await db.categoriaTransaccion.findMany({ select: { id: true, nombre: true } });
  const idPorCategoria = new Map(categorias.map((c) => [c.nombre, c.id]));
  const movimientos = generarTransacciones(recibos, anio);
  const sinCategoria = movimientos.find((m) => !idPorCategoria.has(m.categoria));
  if (sinCategoria) {
    // No debería pasar nunca: hay un test que lo comprueba contra la lista del
    // seed de contenido. Si pasa, es que alguien la ha tocado.
    throw new Error(`La categoría contable «${sinCategoria.categoria}» no está sembrada`);
  }

  await db.transaccion.createMany({
    data: movimientos.map((m) => ({
      tipo: m.tipo as TipoTransaccion,
      categoriaId: idPorCategoria.get(m.categoria)!,
      concepto: m.concepto,
      importe: m.importe,
      fecha: m.fecha,
      metodoPago: m.metodoPago as MetodoPago | null,
      hermanoId: m.dniHermano ? idPorDni.get(m.dniHermano)! : null,
      reciboId: m.claveRecibo ? (idPorClaveRecibo.get(m.claveRecibo) ?? null) : null,
    })),
  });
  console.log(`   ${movimientos.length} movimientos contables`);

  // --- PAPELETAS DE SITIO ---
  // El ropero se calcula ya: quien no ha devuelto la túnica tampoco ha devuelto el cíngulo.
  const papeletasSinCingulo = generarPapeletas(hermanos, recibos);
  const prendas = generarPrendas(papeletasSinCingulo);
  const papeletas = conCingulosSinDevolver(papeletasSinCingulo, prendas);
  // Las de la demostración son todas de la Pasión, la salida con ropero.
  const pasion = await db.salida.findUniqueOrThrow({ where: { slug: 'sabado-de-pasion' } });
  await db.papeletaSitio.createMany({
    data: papeletas.map((p) => ({
      salidaId: pasion.id,
      hermanoId: idPorDni.get(p.dniHermano)!,
      reciboId: idPorClaveRecibo.get(p.claveRecibo)!,
      year: p.year,
      puesto: p.puesto,
      tramo: p.tramo,
      numero: p.numero,
      numTunicaAsignada: p.numTunicaAsignada,
      numCapiroteAsignado: p.numCapiroteAsignado,
      origenTunica: p.origenTunica,
      cingulo: p.cingulo,
    })),
  });
  console.log(`   ${papeletas.length} papeletas de sitio`);

  // --- REPARTO ---
  const { turnos, citas } = generarReparto(hermanos, anio);
  await db.turno.createMany({
    data: turnos.map((t) => ({
      salidaId: pasion.id,
      fecha: t.fecha,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      capacidadEstimada: t.capacidadEstimada,
      activo: t.activo,
    })),
  });
  const turnosCreados = await db.turno.findMany({
    where: { fecha: { in: turnos.map((t) => t.fecha) } },
    select: { id: true, fecha: true },
  });
  const idPorFecha = new Map(turnosCreados.map((t) => [t.fecha.getTime(), t.id]));
  const idPorClaveTurno = new Map(turnos.map((t) => [t.clave, idPorFecha.get(t.fecha.getTime())]));

  await db.cita.createMany({
    data: citas
      .filter((c) => idPorClaveTurno.get(c.claveTurno) !== undefined)
      .map((c) => ({
        turnoId: idPorClaveTurno.get(c.claveTurno)!,
        hermanoId: idPorDni.get(c.dniHermano)!,
        estado: c.estado as EstadoCita,
      })),
  });
  console.log(`   ${turnos.length} turnos de reparto con ${citas.length} citas`);

  // --- ROPERO ---
  // Los cíngulos no van numerados: el Grupo tiene estos (se cuentan en la mesa).
  await db.configuracion.upsert({ where: { key: CLAVE_CINGULOS }, update: { value: '70' }, create: { key: CLAVE_CINGULOS, value: '70' } });
  await db.prenda.createMany({
    data: prendas.map((p) => ({
      numero: p.numero,
      tipo: p.tipo as TipoPrenda,
      talla: p.talla,
      estado: p.estado as EstadoPrenda,
      hermanoId: p.dniHermano ? idPorDni.get(p.dniHermano)! : null,
      fechaAsignacion: p.fechaAsignacion,
      observaciones: p.observaciones,
    })),
  });
  console.log(`   ${prendas.length} prendas en el ropero`);

  // --- SOLICITUDES DE ALTA ---
  // Cuenta y fichas nacen inactivas, igual que en el alta pública de la web
  // (auth.service.ts): eso es exactamente lo que el CMS cuenta como pendiente.
  const solicitudes = generarSolicitudes(anio);
  for (const solicitud of solicitudes) {
    await db.user.create({
      data: {
        email: solicitud.email,
        password,
        dni: solicitud.dni,
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        telefono: solicitud.telefono,
        role: Role.USER,
        active: false,
        hermanos: {
          create: solicitud.fichas.map((f) => ({
            nombre: f.nombre,
            apellidos: f.apellidos,
            dni: f.dni,
            fechaNacimiento: f.fechaNacimiento,
            esTitular: f.esTitular,
            activo: false,
            fechaBaja: null,
          })),
        },
      },
    });
  }
  console.log(`   ${solicitudes.length} solicitudes de alta esperando aprobación`);
}
