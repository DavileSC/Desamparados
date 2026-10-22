/**
 * El aviso previo del cargo de una remesa (la prenotificación SEPA): uno por
 * cuenta con todos sus recibos (una familia que domicilia varias fichas recibe
 * uno, no uno por ficha). Va por correo aunque la cuenta tenga los avisos al
 * móvil: es el aviso que pide la norma, y tiene que quedar por escrito.
 *
 * Aparte de `remesa.service` porque también lo usa `recibo.service` (que
 * aquel importa): un recibo que sale de la remesa antes de que su aviso salga
 * de la cola deja el aviso con un importe que ya no se va a cargar.
 */
import { EstadoEnvio, EstadoPago, Prisma } from '@prisma/client';
import db from '../config/db.js';
import { diaMadrid } from '../domain/contabilidad.js';
import { esDireccionDeNadie } from '../domain/cuenta-de-custodia.js';
import { DOMINIO_CUENTA_ELIMINADA } from '../domain/cuenta-anonimizada.js';
import { enmascararIban } from '../domain/iban.js';
import { aCentimos, leerAcreedorSepa, referenciaMandato, type AcreedorSepa } from '../domain/sepa.js';
import { eurosDeCentimos } from '../utils/euros.js';
import { EmailService, type LineaDeImporte } from './email.service.js';
import { despertarCola, LOTE_AVISO_DE_CARGO } from './correos/cola.js';
import type { Sexo } from './correos/plantilla.js';

const loteDe = (remesaId: number) => `${LOTE_AVISO_DE_CARGO}${remesaId}`;

/** Si a esa cuenta se le puede escribir: sin las de nadie (custodia del censo importado) ni las suprimidas. */
export const cuentaConCorreo = (email: string | null | undefined): email is string =>
  Boolean(email) && !esDireccionDeNadie(email!) && !email!.endsWith(DOMINIO_CUENTA_ELIMINADA);

/** «viernes, 6 de noviembre de 2026», como lo dice el aviso del cargo. */
const diaDelCargo = (fechaCobro: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${fechaCobro}T12:00:00Z`));

interface Cuenta { email: string; nombre: string; sexo: Sexo; lineas: LineaDeImporte[]; centimos: number }

/**
 * Lo que se le carga a cada cuenta: los recibos que siguen en el banco con esa
 * remesa. La referencia del mandato, como la escribe el fichero
 * (`clasificarRecibos`): el hermano y el día en que lo firmó.
 */
async function cuentasDeLaRemesa(remesaId: number, userIds?: number[]): Promise<Map<number, Cuenta>> {
  const recibos = await db.recibo.findMany({
    where: { remesaId, estado: EstadoPago.REMESADO, ...(userIds ? { hermano: { userId: { in: userIds } } } : {}) },
    select: {
      id: true, concepto: true, importe: true,
      hermano: {
        select: {
          id: true, nombre: true, apellidos: true, iban: true, fechaMandato: true, fechaAlta: true,
          user: { select: { id: true, email: true, nombre: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  const porCuenta = new Map<number, Cuenta>();
  for (const r of recibos) {
    const h = r.hermano;
    const u = h.user;
    if (!u || !cuentaConCorreo(u.email)) continue;
    const cuenta = porCuenta.get(u.id) ?? { email: u.email, nombre: u.nombre, sexo: u.hermanos[0]?.sexo ?? undefined, lineas: [], centimos: 0 };
    const centimos = aCentimos(r.importe);
    const mandato = referenciaMandato(h.id, diaMadrid(h.fechaMandato ?? h.fechaAlta));
    const detalle = [`${h.nombre} ${h.apellidos ?? ''}`.trim(), `cuenta ${enmascararIban(h.iban) ?? '—'}`, `mandato ${mandato}`].join(' · ');
    cuenta.lineas.push({ concepto: r.concepto, detalle, importe: eurosDeCentimos(centimos) });
    cuenta.centimos += centimos;
    porCuenta.set(u.id, cuenta);
  }
  return porCuenta;
}

async function correoDe(c: Cuenta, fechaCobro: string, acreedor: AcreedorSepa) {
  const { asunto, html, uso } = await EmailService.correoCargoDomiciliado(c.nombre, c.sexo, {
    fechaCobro: diaDelCargo(fechaCobro), total: eurosDeCentimos(c.centimos), lineas: c.lineas, acreedor: { nombre: acreedor.nombre, id: acreedor.id },
  });
  return { asunto: asunto.slice(0, 200), html, uso };
}

/** Los avisos de una remesa recién generada, a la cola (que los manda delante de todo). Devuelve cuántos. */
export async function ponerAvisosDeCargoEnCola(remesaId: number, fechaCobro: string, acreedor: AcreedorSepa): Promise<number> {
  const titulo = `Aviso de cargo en cuenta · ${fechaCobro.split('-').reverse().join('/')}`;
  const filas: Prisma.CorreoEnColaCreateManyInput[] = [];
  for (const [userId, c] of await cuentasDeLaRemesa(remesaId)) {
    filas.push({ lote: loteDe(remesaId), titulo, userId, porMovil: false, para: c.email, ...(await correoDe(c, fechaCobro, acreedor)) });
  }
  for (let i = 0; i < filas.length; i += 100) await db.correoEnCola.createMany({ data: filas.slice(i, i + 100) });
  void despertarCola();
  return filas.length;
}

/**
 * Un recibo ha salido de la remesa (anulado o devuelto) y el aviso de su
 * cuenta sigue en la cola: se vuelve a escribir con lo que queda, o se retira
 * si ya no queda nada que cargarle. Lo ya enviado no se toca: es lo que
 * recibió. Nunca lanza: el cambio del recibo ya está hecho.
 */
export async function rehacerAvisoDeCargo(reciboId: number): Promise<void> {
  try {
    const recibo = await db.recibo.findUnique({
      where: { id: reciboId },
      select: { remesa: { select: { id: true, fechaCobro: true } }, hermano: { select: { userId: true } } },
    });
    const userId = recibo?.hermano.userId;
    if (!recibo?.remesa || !userId) return;
    const pendiente = await db.correoEnCola.findFirst({
      where: { lote: loteDe(recibo.remesa.id), userId, estado: EstadoEnvio.PENDIENTE },
      select: { id: true },
    });
    if (!pendiente) return;
    const cuenta = (await cuentasDeLaRemesa(recibo.remesa.id, [userId])).get(userId);
    const { acreedor } = leerAcreedorSepa();
    if (!cuenta || !acreedor) {
      await db.correoEnCola.deleteMany({ where: { id: pendiente.id, estado: EstadoEnvio.PENDIENTE } });
      return;
    }
    const correo = await correoDe(cuenta, recibo.remesa.fechaCobro.toISOString().slice(0, 10), acreedor);
    await db.correoEnCola.updateMany({ where: { id: pendiente.id, estado: EstadoEnvio.PENDIENTE }, data: { ...correo, para: cuenta.email } });
  } catch (error) {
    console.error(`[Remesa] No se ha podido rehacer el aviso de cargo del recibo ${reciboId}`, error);
  }
}

/**
 * A cuántas cuentas se avisaría con estos recibos: la previa lo necesita para
 * saber cuándo saldrá el último aviso con el tope diario de correos.
 */
export async function cuentasQueSeAvisarian(reciboIds: number[]): Promise<number> {
  if (reciboIds.length === 0) return 0;
  const usuarios = await db.user.findMany({
    where: { hermanos: { some: { recibos: { some: { id: { in: reciboIds } } } } } },
    select: { email: true },
  });
  return usuarios.filter((u) => cuentaConCorreo(u.email)).length;
}
