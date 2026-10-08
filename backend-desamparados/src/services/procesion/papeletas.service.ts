/**
 * La solicitud y la papeleta de cada salida.
 *
 * Pedir salir (desde el área de hermanos o en la mesa) crea una Solicitud: ni
 * papeleta ni recibo. Lo que haya que pagar de la salida (su cuota, que puede
 * ser 0 €, o el donativo) se convierte en recibo al pagarlo. La
 * papeleta nace al recoger en Túnicas: si alguien no aparece, no queda nada
 * que anular. Aquí también se anula una papeleta, se cancela una solicitud,
 * el listado de los diputados de tramo y el repaso de quien pidió día y no vino.
 *
 * Aquí se mueve dinero del Grupo Parroquial: cada operación deja su rastro en
 * la auditoría y el importe lo calcula siempre el servidor.
 */
import db from '../../config/db';
import { Cingulo, EstadoCita, EstadoPago, EstadoSolicitud, MetodoPago, OrigenSolicitud, Prisma } from '@prisma/client';
import { EmailService } from '../email.service';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import { devolverCobroEnTransaccion, idCategoriaDevoluciones, retirarPapeletaEnTransaccion } from '../recibos/comunes.js';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { enmascararEmail } from '../../utils/log-privacidad.js';
import { puedeTransicionar } from '../../domain/recibo-estados.js';
import { conceptoDeSalida, tipoReciboDe } from '../../domain/salidas.js';
import { aArticulo, articuloDe, deArticulo } from '../../domain/articulos.js';
import type { SalidaConActo } from './salidas.service.js';
import { recogerRopaEnTransaccion } from './ropa.js';
import { avisarALaMesa } from './avisos-mesa.js';
import { diaMadridComoIntervalo } from '../../domain/contabilidad.js';

type Tx = Prisma.TransactionClient;

const NOTA_ANULACION = 'Anulado por devolución de la papeleta de sitio.';
const NOTA_CANCELACION = 'Devuelto al cancelar la solicitud de salida.';

export interface NuevaSolicitud {
  hermanoId: number;
  salida: SalidaConActo;
  year: number;
  puesto: string;
  observaciones?: string | null;
  /** La voluntad, en euros, en las salidas de donativo. En las de cuota no cuenta: manda la cuota. */
  donativo?: number;
  /** El día de reparto que eligió, si lo eligió. */
  citaId?: number | null;
  origen: OrigenSolicitud;
}

export interface DatosDeLaPapeleta {
  puesto: string;
  observaciones?: string | null;
  origenTunica: 'ROPERO' | 'PROPIA' | 'NINGUNA' | null;
  numTunicaAsignada: string | null;
  numCapiroteAsignado: string | null;
  numFaraonaAsignada: string | null;
  cingulo?: Cingulo | null;
}

/** Una solicitud leída con lo que hace falta para cobrarla o recogerla. */
export type SolicitudConRecibo = Prisma.SolicitudGetPayload<{ include: { recibo: true } }>;

export class PapeletasService {

  /** Listado de quién esperamos HOY. */
  static async getAsistentesDelDia(fecha: Date) {
    // El día de Madrid, no el del reloj del servidor (que corre en UTC).
    const { desde, hasta } = diaMadridComoIntervalo(fecha);

    return await db.cita.findMany({
      where: {
        turno: { fecha: { gte: desde, lt: hasta } },
        estado: EstadoCita.RESERVADA
      },
      include: {
        hermano: {
          // Traemos datos clave para identificarlo rápido
          select: { id: true, nombre: true, apellidos: true, dni: true, tieneTunicaPropia: true, tunica: true }
        }
      }
    });
  }

  /** La solicitud viva (pendiente de recoger) de alguien en una salida y año, si la tiene. */
  static solicitudPendiente(cliente: Tx | typeof db, hermanoId: number, year: number, salidaId: number) {
    return cliente.solicitud.findFirst({
      where: { hermanoId, year, salidaId, estado: EstadoSolicitud.PENDIENTE },
      include: { recibo: true },
      orderBy: { id: 'desc' },
    });
  }

  /**
   * Crea la solicitud dentro de la transacción de quien llama (el área de
   * hermanos o la zona de Inscripción). Comprueba dentro que no tenga ya una
   * pendiente ni la papeleta de esa salida y año, para que dos peticiones a
   * la vez no pasen las dos (la transacción tiene que ser serializable).
   */
  static async crearSolicitudEnTransaccion(tx: Tx, datos: NuevaSolicitud) {
    const { hermanoId, salida, year } = datos;
    const articulo = articuloDe(salida);
    if (await tx.papeletaSitio.findUnique({ where: { hermanoId_year_salidaId: { hermanoId, year, salidaId: salida.id } } })) {
      throw new HttpError(`Ya tiene su papeleta ${deArticulo(articulo, salida.nombre)} de ${year}.`, 409);
    }
    if (await PapeletasService.solicitudPendiente(tx, hermanoId, year, salida.id)) {
      throw new HttpError(`Ya está apuntado ${aArticulo(articulo, salida.nombre)} de ${year}.`, 409);
    }
    return tx.solicitud.create({
      data: {
        hermanoId, salidaId: salida.id, year,
        puesto: datos.puesto.trim(),
        observaciones: datos.observaciones?.trim() || null,
        donativo: salida.cobro === 'DONATIVO' ? new Prisma.Decimal(Math.round((datos.donativo ?? 0) * 100) / 100) : null,
        citaId: datos.citaId ?? undefined,
        origen: datos.origen,
      },
    });
  }

  /**
   * El recibo de la salida de una solicitud, ya cobrado (o exento si es 0 €),
   * con el concepto de `conceptoDeSalida`: `Papeleta ${nombre} ${año}` (o
   * `Donativo …` si la salida cobra donativo). Si ya se le anuló una este
   * año, sale como reemisión.
   */
  static async reciboDeSalidaEnTransaccion(
    tx: Tx,
    solicitud: { id: number; hermanoId: number; salidaId: number; year: number },
    importe: number,
    metodoPago: MetodoPago | null,
  ) {
    const salida = await tx.salida.findUniqueOrThrow({ where: { id: solicitud.salidaId }, select: { nombre: true, cobro: true } });
    const conceptos = (await tx.recibo.findMany({ where: { hermanoId: solicitud.hermanoId, year: solicitud.year }, select: { concepto: true } })).map((r) => r.concepto);
    const pagado = importe > 0;
    const recibo = await tx.recibo.create({
      data: {
        year: solicitud.year,
        concepto: conceptoDeSalida(salida, solicitud.year, conceptos),
        importe: new Prisma.Decimal(importe),
        tipo: tipoReciboDe(salida.cobro),
        estado: pagado ? EstadoPago.PAGADO : EstadoPago.EXENTO,
        metodoPago: pagado ? metodoPago : null,
        fechaPago: pagado ? new Date() : null,
        hermanoId: solicitud.hermanoId,
      },
    });
    await tx.solicitud.update({ where: { id: solicitud.id }, data: { reciboId: recibo.id } });
    return recibo;
  }

  /**
   * La papeleta, al recoger en Túnicas: con el puesto confirmado y la ropa
   * que se lleva. Su recibo es el que pagó la salida o, si no había nada que
   * pagar, uno exento de 0 €. La solicitud queda recogida y la cita, atendida.
   */
  static async crearPapeletaEnTransaccion(tx: Tx, solicitud: SolicitudConRecibo, datos: DatosDeLaPapeleta) {
    const reciboId = solicitud.reciboId ?? (await PapeletasService.reciboDeSalidaEnTransaccion(tx, solicitud, 0, null)).id;
    const papeleta = await tx.papeletaSitio.create({
      data: {
        year: solicitud.year,
        salidaId: solicitud.salidaId,
        hermanoId: solicitud.hermanoId,
        reciboId,
        citaId: solicitud.citaId ?? undefined,
        puesto: datos.puesto.trim(),
        observaciones: datos.observaciones?.trim() || null,
        origenTunica: datos.origenTunica,
        numTunicaAsignada: datos.numTunicaAsignada,
        numCapiroteAsignado: datos.numCapiroteAsignado,
        numFaraonaAsignada: datos.numFaraonaAsignada,
        cingulo: datos.cingulo ?? null,
      },
    });
    const { count } = await tx.solicitud.updateMany({
      where: { id: solicitud.id, estado: EstadoSolicitud.PENDIENTE },
      data: { estado: EstadoSolicitud.RECOGIDA, papeletaId: papeleta.id },
    });
    if (count !== 1) throw new HttpError('Esta solicitud acaba de cambiar. Recarga la ficha.', 409);
    if (solicitud.citaId) {
      await tx.cita.updateMany({ where: { id: solicitud.citaId, estado: { not: EstadoCita.ATENDIDA } }, data: { estado: EstadoCita.ATENDIDA } });
    }
    return papeleta;
  }

  /**
   * Cancelar una solicitud que no se ha recogido: se echa atrás, o se apuntó
   * por error. Si ya pagó la salida (el donativo), el cobro se devuelve con su
   * reverso en contabilidad; la cita, si la tenía, queda cancelada.
   */
  static async cancelarSolicitudEnTransaccion(tx: Tx, solicitud: SolicitudConRecibo, categoriaDevolucionesId: number) {
    // Suelta la cita: si vuelve a pedir el mismo día, la cita es la misma.
    const { count } = await tx.solicitud.updateMany({
      where: { id: solicitud.id, estado: EstadoSolicitud.PENDIENTE },
      data: { estado: EstadoSolicitud.CANCELADA, citaId: null },
    });
    if (count !== 1) throw new HttpError('Esta solicitud ya no está pendiente. Recarga la ficha.', 409);
    const recibo = solicitud.recibo;
    if (recibo?.estado === EstadoPago.PAGADO) {
      await devolverCobroEnTransaccion(tx, recibo, categoriaDevolucionesId, [recibo.observaciones, NOTA_CANCELACION].filter(Boolean).join(' · '));
    }
    if (solicitud.citaId) {
      await tx.cita.updateMany({ where: { id: solicitud.citaId, estado: EstadoCita.RESERVADA }, data: { estado: EstadoCita.CANCELADA } });
    }
  }

  /** Cancelar una solicitud desde la mesa (el listado), con su rastro. */
  static async cancelarSolicitud(solicitudId: number, meta?: MetaDeAuditoria) {
    const categoriaDevolucionesId = await idCategoriaDevoluciones();
    const solicitud = await db.$transaction(async (tx) => {
      const s = await tx.solicitud.findUnique({ where: { id: solicitudId }, include: { recibo: true } });
      if (!s) throw new NotFoundError('Solicitud no encontrada.');
      await PapeletasService.cancelarSolicitudEnTransaccion(tx, s, categoriaDevolucionesId);
      return s;
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.SOLICITUD_SALIDA_CANCELAR, meta ?? {}, 'solicitud', solicitudId, {
      antes: {
        hermanoId: solicitud.hermanoId, year: solicitud.year, salidaId: solicitud.salidaId, puesto: solicitud.puesto,
        recibo: solicitud.recibo && { id: solicitud.recibo.id, estado: solicitud.recibo.estado },
      },
      despues: { estado: EstadoSolicitud.CANCELADA },
    });
    avisarALaMesa({ que: 'anulado', hermanoId: solicitud.hermanoId, salidaId: solicitud.salidaId });
    return {
      message: solicitud.recibo?.estado === EstadoPago.PAGADO
        ? 'Solicitud cancelada. Lo pagado queda devuelto con su reverso en contabilidad.'
        : 'Solicitud cancelada.',
    };
  }

  /**
   * Anular una papeleta ya recogida: el hermano no sale (enfermedad, un
   * error). El recibo sigue el grafo de estados como cualquier otro: si
   * estaba cobrado pasa a DEVUELTO con su asiento de reverso; si era exento,
   * se queda como está porque no hubo dinero. La ropa vuelve al ropero, la
   * papeleta se borra y su solicitud queda cancelada: puede volver a
   * apuntarse, y su nuevo recibo sale como reemisión.
   */
  static async anularPapeleta(papeletaId: number, meta?: MetaDeAuditoria) {
    const categoriaDevolucionesId = await idCategoriaDevoluciones();

    const resultado = await db.$transaction(async (tx) => {
      const papeleta = await tx.papeletaSitio.findUnique({ where: { id: papeletaId }, include: { recibo: true } });
      if (!papeleta) throw new NotFoundError('Papeleta no encontrada');
      const estadoFinal = await PapeletasService.anularEnTransaccion(tx, papeleta, categoriaDevolucionesId);
      return { papeleta, recibo: papeleta.recibo, estadoFinal };
    });

    const { papeleta, recibo, estadoFinal } = resultado;
    await AuditoriaService.log(ACCIONES_AUDITORIA.PAPELETA_ANULAR, meta ?? {}, 'papeleta', papeletaId, {
      antes: {
        papeleta: { hermanoId: papeleta.hermanoId, year: papeleta.year, salidaId: papeleta.salidaId, puesto: papeleta.puesto, tramo: papeleta.tramo, citaId: papeleta.citaId },
        recibo: { id: recibo.id, estado: recibo.estado, importe: String(recibo.importe) }
      },
      despues: { papeleta: null, recibo: { id: recibo.id, estado: estadoFinal } }
    });
    avisarALaMesa({ que: 'anulado', hermanoId: papeleta.hermanoId, salidaId: papeleta.salidaId });

    return {
      message: estadoFinal === EstadoPago.DEVUELTO && recibo.estado === EstadoPago.PAGADO
        ? 'Papeleta anulada. El cobro queda devuelto con su reverso en contabilidad. Ropa liberada.'
        : 'Papeleta anulada. Ropa liberada.',
      reciboId: recibo.id,
      estadoRecibo: estadoFinal
    };
  }

  /** El recibo, la ropa, la solicitud y la cita de una papeleta que se anula; la papeleta, fuera. */
  static async anularEnTransaccion(
    tx: Tx,
    papeleta: Prisma.PapeletaSitioGetPayload<{ include: { recibo: true } }>,
    categoriaDevolucionesId: number,
  ): Promise<EstadoPago> {
    const recibo = papeleta.recibo;
    const observaciones = [recibo.observaciones, NOTA_ANULACION].filter(Boolean).join(' · ');
    let estadoFinal: EstadoPago = recibo.estado;

    if (recibo.estado === EstadoPago.PAGADO) {
      await devolverCobroEnTransaccion(tx, recibo, categoriaDevolucionesId, observaciones);
      estadoFinal = EstadoPago.DEVUELTO;
    } else if (puedeTransicionar(recibo.estado, EstadoPago.ANULADO)) {
      const transicion = await tx.recibo.updateMany({
        where: { id: recibo.id, estado: recibo.estado },
        data: { estado: EstadoPago.ANULADO, observaciones }
      });
      if (transicion.count !== 1) {
        throw new HttpError('El estado del recibo ha cambiado. Recarga la ficha e inténtalo de nuevo.', 409);
      }
      estadoFinal = EstadoPago.ANULADO;
    } else {
      // EXENTO, o ya DEVUELTO/ANULADO: estados finales, solo se anota el motivo.
      await tx.recibo.update({ where: { id: recibo.id }, data: { observaciones } });
    }

    // La ropa que se le prestó con esta papeleta, de vuelta al ropero.
    await recogerRopaEnTransaccion(tx, papeleta.hermanoId, papeleta);
    // Su solicitud, cancelada: si vuelve, pide otra.
    await tx.solicitud.updateMany({ where: { papeletaId: papeleta.id }, data: { estado: EstadoSolicitud.CANCELADA, citaId: null } });
    // Libera la cita y borra la papeleta (hueco en la procesión y clave [hermano, año, salida]).
    await retirarPapeletaEnTransaccion(tx, recibo.id);
    return estadoFinal;
  }

  /** Genera el censo de la procesión para los diputados de tramo / mayordomos. */
  static async getListadoProcesion(year: number, salida: SalidaConActo) {
    return await db.papeletaSitio.findMany({
      where: { year, salidaId: salida.id },
      include: {
        hermano: {
          select: { nombre: true, apellidos: true, telefono: true, alturaHombro: true }
        }
      },
      // Los ordenamos primero por tramo y luego por su número de orden
      orderBy: [
        { tramo: 'asc' },
        { numero: 'asc' }
      ]
    });
  }

  /**
   * Mantenimiento: procesa a los hermanos que pidieron día pero no vinieron a
   * recoger la papeleta.
   * @param fechaLimite Instante hasta el que revisar: cuentan los turnos que ya
   *   habían TERMINADO entonces (el controlador lo calcula con instanteLimiteAusencias).
   * @param esCierreDefinitivo Si es TRUE, limpia las citas sin mandar correos de "vuelve a pedir cita".
   */
  static async procesarAusencias(fechaLimite: Date = new Date(), esCierreDefinitivo: boolean = false, meta?: MetaDeAuditoria) {
    // Última barrera por si alguien llama al servicio sin pasar por el esquema:
    // una fecha futura marcaría como ausentes a quienes aún no les ha tocado.
    if (Number.isNaN(fechaLimite.getTime()) || fechaLimite.getTime() > Date.now()) {
      throw new HttpError('La fecha límite debe ser una fecha válida que no sea posterior a hoy.');
    }

    const ausentes = await db.cita.findMany({
      where: {
        estado: EstadoCita.RESERVADA,
        // Por el FIN del turno, no por su fecha. `fecha` es la medianoche del
        // día y `horaInicio`/`horaFin` son instantes completos de ese mismo día
        // (así los crean crearTurno y la siembra): comparando `fecha`, el turno
        // de esta tarde entraba ya por la mañana y se mandaba el «no viniste» a
        // quien aún no había tenido ocasión de venir.
        turno: { horaFin: { lt: fechaLimite } },
        // Pidió día y no pasó a recogerla: esa cita no tiene papeleta.
        papeleta: null
      },
      include: {
        hermano: { include: { user: true } },
        // Su salida, para que el recordatorio la nombre.
        turno: { include: { salida: true } }
      }
    });

    const estadoNuevo = esCierreDefinitivo ? EstadoCita.CANCELADA : EstadoCita.NO_PRESENTADO;
    const idsAusentes = ausentes.map(a => a.id);

    // Condicionado a que sigan RESERVADA: si la mesa atendió a alguno entre
    // la lectura y aquí, no se le marca ausente.
    const { count } = idsAusentes.length === 0
      ? { count: 0 }
      : await db.cita.updateMany({
          where: { id: { in: idsAusentes }, estado: EstadoCita.RESERVADA },
          data: { estado: estadoNuevo }
        });

    await AuditoriaService.log(ACCIONES_AUDITORIA.AUSENCIAS_PROCESAR, meta ?? {}, 'cita', undefined, {
      fechaLimite: fechaLimite.toISOString(),
      cierreDefinitivo: esCierreDefinitivo,
      estadoNuevo,
      citasAfectadas: count,
      citaIds: idsAusentes
    });

    if (count === 0) return { message: 'No hay ausencias pendientes de procesar.', procesadas: 0 };

    // Si es cierre definitivo, sus solicitudes sin recoger se cancelan (las
    // que ya pagaron la voluntad, no: eso lo resuelve Tesorería) y se corta aquí.
    if (esCierreDefinitivo) {
      const canceladas = await db.solicitud.updateMany({
        where: {
          citaId: { in: idsAusentes }, estado: EstadoSolicitud.PENDIENTE,
          OR: [{ reciboId: null }, { recibo: { estado: { not: EstadoPago.PAGADO } } }],
        },
        data: { estado: EstadoSolicitud.CANCELADA, citaId: null },
      });
      return {
        message: `CIERRE DE PLAZO: ${count} citas caducadas han sido canceladas, y ${canceladas.count} solicitudes sin recoger.`,
        procesadas: count,
      };
    }

    // Solo se escribe a quien de verdad ha quedado como no presentado.
    const marcadas = new Set((await db.cita.findMany({
      where: { id: { in: idsAusentes }, estado: EstadoCita.NO_PRESENTADO },
      select: { id: true }
    })).map(c => c.id));

    for (const cita of ausentes) {
      if (marcadas.has(cita.id) && cita.hermano?.user?.email) {
        const fechaStr = cita.turno.fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
        // Importante añadir 'await' para que no se sature el servidor si hay 500 emails
        await EmailService.enviarRecordatorioAusencia(
          cita.hermano.user.email,
          cita.hermano.nombre,
          fechaStr,
          { nombre: cita.turno.salida.nombre, articulo: articuloDe(cita.turno.salida) },
          cita.hermano.sexo
        ).catch(() => console.error(`Error enviando email a ${enmascararEmail(cita.hermano.user.email)}`));
      }
    }

    return { message: `Se han procesado ${count} ausencias. Citas actualizadas a NO_PRESENTADO y correos enviados.`, procesadas: count };
  }
}
