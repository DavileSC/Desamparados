/**
 * Remesas SEPA: Tesorería junta los recibos pendientes de quienes domicilian,
 * genera el fichero para la banca en línea y, cuando el banco los carga, da la
 * remesa por cobrada.
 *
 * El fichero y las reglas de qué entra viven en `domain/sepa.ts`; aquí, las
 * consultas, la transacción y el rastro. Los datos del Grupo como acreedor
 * salen del entorno (`SEPA_ACREEDOR_*`): sin ellos se puede ver qué entraría,
 * pero no generar nada.
 */
import { randomUUID } from 'node:crypto';
import { EstadoPago, EstadoRemesa, MetodoPago, Prisma, TipoRecibo } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { ReciboService } from './recibo.service.js';
import { diaDeHoy } from '../domain/fechas-hermano.js';
import { instanteDelApunte } from '../domain/contabilidad.js';
import { deLaCorporacion } from '../domain/articulos.js';
import {
  TEXTO_EXCLUSION, aCentimos, clasificarRecibos, fechaCobroMinima, generarPain008, importeXml, leerAcreedorSepa,
  mensajeIdDeRemesa, problemaFechaCobro, type MotivoExclusion, type ReciboCandidato,
} from '../domain/sepa.js';

export interface FiltroRemesa {
  fechaCobro: string;
  year?: number;
  tipo?: TipoRecibo;
}

type Cliente = Prisma.TransactionClient | typeof db;

const diaDeFechaCobro = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** Los recibos pendientes de quienes domicilian, con lo justo de su ficha. */
async function candidatos(cliente: Cliente, filtro: FiltroRemesa) {
  const filas = await cliente.recibo.findMany({
    where: {
      estado: EstadoPago.PENDIENTE,
      hermano: { formaPagoPref: MetodoPago.DOMICILIACION },
      ...(filtro.year ? { year: filtro.year } : {}),
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
    },
    select: {
      id: true, concepto: true, importe: true,
      hermano: {
        select: {
          id: true, nombre: true, apellidos: true, numeroHermano: true, activo: true,
          iban: true, titularCuenta: true, fechaMandato: true, fechaAlta: true,
        },
      },
    },
    orderBy: [{ hermano: { apellidos: 'asc' } }, { id: 'asc' }],
  });
  const lista: ReciboCandidato[] = filas.map((f) => ({
    id: f.id, concepto: f.concepto, centimos: aCentimos(f.importe), hermano: f.hermano,
  }));
  return { filas, ...clasificarRecibos(lista) };
}

function comprobarFecha(fechaCobro: string) {
  const problema = problemaFechaCobro(fechaCobro, diaDeHoy());
  if (problema) throw new HttpError(problema);
}

const resumenRemesa = (r: {
  id: number; mensajeId: string; fechaCobro: Date; numRecibos: number; total: Prisma.Decimal; estado: EstadoRemesa;
  cobradaEl: Date | null; autorNombre: string | null; createdAt: Date;
}) => ({
  id: r.id,
  mensajeId: r.mensajeId,
  fechaCobro: diaDeFechaCobro(r.fechaCobro),
  numRecibos: r.numRecibos,
  total: Number(r.total),
  estado: r.estado,
  cobradaEl: r.cobradaEl,
  autorNombre: r.autorNombre,
  createdAt: r.createdAt,
});

const SELECT_RESUMEN = {
  id: true, mensajeId: true, fechaCobro: true, numRecibos: true, total: true, estado: true,
  cobradaEl: true, autorNombre: true, createdAt: true,
} satisfies Prisma.RemesaSelect;

export class RemesaService {
  /**
   * Lo que necesita la pantalla antes de nada: si el servidor tiene los datos
   * del acreedor, desde qué día se puede cobrar y las remesas ya hechas. Son
   * pocas (una o dos al año), así que van todas, las más recientes primero.
   */
  static async estado() {
    const { problemas } = leerAcreedorSepa();
    const remesas = await db.remesa.findMany({ select: SELECT_RESUMEN, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200 });
    // Lo que quedaría sin cobrar si se diera por cobrada hoy: los recibos que
    // siguen en el banco. Tesorería ve de un vistazo si hay devoluciones.
    const enElBanco = await db.recibo.groupBy({
      by: ['remesaId'],
      where: { remesaId: { in: remesas.map((r) => r.id) }, estado: EstadoPago.REMESADO },
      _count: { _all: true },
    });
    const pendientes = new Map(enElBanco.map((g) => [g.remesaId, g._count._all]));
    return {
      configurada: problemas.length === 0,
      problemas,
      fechaCobroMinima: fechaCobroMinima(diaDeHoy()),
      remesas: remesas.map((r) => ({ ...resumenRemesa(r), enElBanco: pendientes.get(r.id) ?? 0 })),
    };
  }

  /** Qué entraría en la remesa y qué se queda fuera, sin tocar nada. */
  static async previa(filtro: FiltroRemesa) {
    comprobarFecha(filtro.fechaCobro);
    const { filas, adeudos, excluidos } = await candidatos(db, filtro);
    const porId = new Map(filas.map((f) => [f.id, f]));
    return {
      fechaCobro: filtro.fechaCobro,
      numRecibos: adeudos.length,
      total: Number(importeXml(adeudos.reduce((s, a) => s + a.centimos, 0))),
      excluidos: excluidos.map((e) => {
        const fila = porId.get(e.reciboId)!;
        return {
          reciboId: e.reciboId,
          concepto: fila.concepto,
          importe: Number(fila.importe),
          hermano: { id: fila.hermano.id, nombre: fila.hermano.nombre, apellidos: fila.hermano.apellidos, numeroHermano: fila.hermano.numeroHermano },
          motivo: e.motivo as MotivoExclusion,
          texto: TEXTO_EXCLUSION[e.motivo],
        };
      }),
    };
  }

  /**
   * Genera la remesa: la apunta, escribe el fichero y pasa sus recibos a
   * remesados, todo o nada. Serializable: dos tesoreros a la vez leerían los
   * mismos pendientes y mandarían cada recibo al banco dos veces.
   */
  static async generar(filtro: FiltroRemesa, meta?: MetaDeAuditoria) {
    comprobarFecha(filtro.fechaCobro);
    const { acreedor, problemas } = leerAcreedorSepa();
    if (!acreedor) throw new HttpError(`Faltan los datos ${deLaCorporacion({ corto: true })} como acreedor SEPA. ${problemas.join(' ')}`, 409);

    const autor = meta?.userId
      ? await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true, apellidos: true } })
      : null;

    const remesa = await transactionWithRetry(async (tx) => {
      const { adeudos } = await candidatos(tx, filtro);
      if (adeudos.length === 0) throw new HttpError('No hay recibos que se puedan mandar al banco con estos filtros.', 409);
      const centimos = adeudos.reduce((s, a) => s + a.centimos, 0);
      const creadaEl = new Date();

      // El identificador del fichero lleva el número de la remesa, que no se
      // sabe hasta crearla: se apunta con uno provisional y se corrige dentro
      // de la misma transacción.
      const creada = await tx.remesa.create({
        data: {
          mensajeId: `TMP-${randomUUID().slice(0, 30)}`,
          fechaCobro: new Date(`${filtro.fechaCobro}T00:00:00Z`),
          numRecibos: adeudos.length,
          total: new Prisma.Decimal(importeXml(centimos)),
          xml: '',
          autorId: meta?.userId ?? null,
          autorNombre: autor ? `${autor.nombre} ${autor.apellidos}`.trim() : null,
          createdAt: creadaEl,
        },
      });
      const mensajeId = mensajeIdDeRemesa(creada.id, filtro.fechaCobro);
      const xml = generarPain008({ mensajeId, creadaEl, fechaCobro: filtro.fechaCobro, acreedor, adeudos });

      // Condicionado a que sigan pendientes: si alguien cobró uno en la
      // ventanilla mientras tanto, la remesa no sale con un recibo ya pagado.
      const cambiados = await tx.recibo.updateMany({
        where: { id: { in: adeudos.map((a) => a.reciboId) }, estado: EstadoPago.PENDIENTE },
        data: { estado: EstadoPago.REMESADO, metodoPago: MetodoPago.DOMICILIACION, remesaId: creada.id },
      });
      if (cambiados.count !== adeudos.length) {
        throw new HttpError('Algún recibo cambió mientras se preparaba la remesa. Vuelve a intentarlo.', 409);
      }
      return tx.remesa.update({ where: { id: creada.id }, data: { mensajeId, xml }, select: SELECT_RESUMEN });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await AuditoriaService.log(ACCIONES_AUDITORIA.REMESA_GENERAR, meta ?? {}, 'remesa', remesa.id, {
      despues: {
        fechaCobro: filtro.fechaCobro, numRecibos: remesa.numRecibos, total: remesa.total.toString(),
        ...(filtro.year ? { year: filtro.year } : {}), ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      },
    });
    return resumenRemesa(remesa);
  }

  /** El fichero tal cual salió, para subirlo (o volver a subirlo) al banco. */
  static async fichero(id: number) {
    const remesa = await db.remesa.findUnique({ where: { id }, select: { mensajeId: true, xml: true } });
    if (!remesa) throw new NotFoundError('Remesa no encontrada.');
    return { nombre: `${remesa.mensajeId.toLowerCase()}.xml`, xml: remesa.xml };
  }

  /**
   * El banco cargó los adeudos: los recibos que siguen remesados pasan a
   * pagados, cada uno con su asiento de ingreso (la misma operación que el
   * cobro en ventanilla). Los que el banco devolvió ya se marcaron como
   * devueltos y no se tocan. Se puede repetir: si se corta a medias, la
   * segunda vez cobra solo lo que faltaba.
   *
   * Los asientos llevan el día en que el banco cargó los adeudos: la fecha
   * valor del extracto si viene de la Norma 43 y, si no, la fecha de cobro de
   * la remesa. Con la del clic, un cobro de septiembre dado por bueno en
   * octubre caía en el mes equivocado y no cuadraba con el banco.
   */
  static async darPorCobrada(id: number, meta?: MetaDeAuditoria, fechaValor?: string) {
    const remesa = await db.remesa.findUnique({ where: { id }, select: { id: true, estado: true, fechaCobro: true } });
    if (!remesa) throw new NotFoundError('Remesa no encontrada.');
    if (remesa.estado === EstadoRemesa.COBRADA) throw new HttpError('Esta remesa ya estaba cobrada.', 409);
    const fechaCobro = diaDeFechaCobro(remesa.fechaCobro);
    if (diaDeHoy() < fechaCobro) {
      throw new HttpError(`El banco carga los adeudos el ${fechaCobro.split('-').reverse().join('/')}: dala por cobrada a partir de ese día.`, 409);
    }

    const enElBanco = await db.recibo.findMany({
      where: { remesaId: id, estado: EstadoPago.REMESADO },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const fechaCargo = instanteDelApunte(fechaValor ?? fechaCobro);
    let cobrados = 0;
    for (const { id: reciboId } of enElBanco) {
      try {
        await ReciboService.adminMarcarComoPagado(reciboId, MetodoPago.DOMICILIACION, meta, fechaCargo);
        cobrados += 1;
      } catch (error) {
        // Otro lo cobró o lo devolvió mientras tanto: ya no es de esta remesa cobrarlo.
        if (!(error instanceof HttpError && error.status === 409)) throw error;
      }
    }

    const devueltos = await db.recibo.count({ where: { remesaId: id, estado: EstadoPago.DEVUELTO } });
    await db.remesa.update({ where: { id }, data: { estado: EstadoRemesa.COBRADA, cobradaEl: new Date() } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.REMESA_COBRAR, meta ?? {}, 'remesa', id, {
      antes: { estado: remesa.estado },
      despues: { estado: EstadoRemesa.COBRADA, cobrados, devueltos },
    });

    const partes = [`${cobrados === 1 ? 'Se ha cobrado 1 recibo' : `Se han cobrado ${cobrados} recibos`}.`];
    if (devueltos > 0) partes.push(`${devueltos === 1 ? '1 recibo devuelto se queda' : `${devueltos} recibos devueltos se quedan`} como estaba${devueltos === 1 ? '' : 'n'}.`);
    return { message: partes.join(' '), cobrados, devueltos };
  }
}
