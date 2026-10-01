/**
 * La procesión vista por el hermano desde su área: qué salidas tienen el
 * plazo abierto, pedir salir (con el puesto que le gustaría y el día en que
 * pasará a recoger la papeleta), echarse atrás y consultar sus papeletas de
 * otros años. Las salidas son las activas del CMS (ver `SalidasService`).
 *
 * Pedir salir crea una solicitud, no una papeleta: la papeleta nace cuando
 * la recoge en la mesa. Si no aparece, no queda nada que anular.
 *
 * Todo lo de aquí comprueba antes que la ficha sea suya: es la puerta por la
 * que se apuntaría a otro cambiando un número en la petición.
 */
import db from '../../config/db';
import { EstadoCita, EstadoPago, EstadoSolicitud, OrigenSolicitud, Prisma } from '@prisma/client';
import { AvisarAsistenciaDto } from '../../dtos/procesion.dto';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { transactionWithRetry } from '../../utils/transaction-retry.js';
import { sanearPaginacion, respuestaPaginada } from '../../domain/paginacion.js';
import { conceptoDeSalida, pagoEnLineaDisponible } from '../../domain/salidas.js';
import { pagoParaLaWeb } from '../../domain/redsys.js';
import QRCode from 'qrcode';
import { codigoDePapeleta } from '../../domain/papeleta-qr.js';
import { aArticulo, articuloDe, deArticulo } from '../../domain/articulos.js';
import { referenciaDe } from './papeleta-pdf.js';
import { leerDatosEvento } from '../recibos/comunes.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { idCategoriaDevoluciones } from '../recibos/comunes.js';
import { PlazoPapeletasService, cuotaDe } from './plazo.service.js';
import { SalidasService, type SalidaConActo } from './salidas.service.js';
import { PapeletasService } from './papeletas.service.js';
import { cuotasQueCuentan, pendienteDe } from './zonas.service.js';
import { avisarALaMesa } from './avisos-mesa.js';

export class MiProcesionService {

  /** Los días de reparto de una salida que quedan, y cuánta gente va a ir. */
  static async getDiasDisponibles(salida: SalidaConActo) {
    const turnos = await db.turno.findMany({
      where: {
        activo: true,
        salidaId: salida.id,
        fecha: { gte: new Date() } // Solo futuros
      },
      orderBy: { fecha: 'asc' },
      include: {
        _count: {
          // Solo las que siguen en pie: con las canceladas, un día medio vacío
          // parecía lleno mientras el aforo (que ya filtraba) dejaba reservar.
          select: { citas: { where: { estado: EstadoCita.RESERVADA } } }
        }
      }
    });

    return turnos.map(t => ({
      id: t.id,
      salida: salida.slug,
      fecha: t.fecha,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      // Info útil para el usuario: "Hay 15 apuntados"
      genteApuntada: t._count.citas,
      // Para avisar de un día casi lleno y no ofrecer uno completo.
      capacidad: t.capacidadEstimada
    }));
  }

  /**
   * El hermano pide salir con una ficha suya: el puesto que le gustaría (lo
   * decide el Grupo) y el día de reparto en que pasará a recoger la papeleta.
   * La salida es la del día elegido. Nace la solicitud, sin papeleta ni
   * recibo: la papeleta nace en la mesa, al recogerla.
   */
  static async avisarAsistencia(userId: number, { turnoId, hermanoId, puesto, donativo }: AvisarAsistenciaDto, meta?: MetaDeAuditoria) {

    // 0. BARRERA BOLA: Verificar que este hermano pertenece a este usuario
    const checkPropiedad = await db.hermano.findFirst({
      where: { id: hermanoId, userId: userId, activo: true }
    });
    if (!checkPropiedad) {
      throw new HttpError('No tienes permisos para apuntar a este cofrade.');
    }

    // Todas las comprobaciones y la creación van en la misma transacción
    // serializable. Fuera de ella, dos avisos a la vez (doble clic, o dos
    // dispositivos de la misma familia) pasaban los dos el «Ya tienes un día
    // reservado» y el hermano acababa con dos citas; y el aforo podía
    // rebasarse por lo mismo.
    const resultado = await transactionWithRetry(async (tx) => {
      const turno = await tx.turno.findUnique({ where: { id: turnoId }, include: { salida: { include: { acto: true } } } });
      if (!turno || !turno.activo || turno.fecha < new Date()) {
        throw new HttpError('El turno no existe o ya no está disponible.');
      }
      const { salida } = turno;
      const articulo = articuloDe(salida);
      // Con el plazo cerrado no se pide, lo intente la pantalla o alguien a mano.
      if (!(await PlazoPapeletasService.estaAbierto(salida, tx))) {
        throw new HttpError(`La inscripción ${deArticulo(articulo, salida.nombre)} no está abierta.`, 409);
      }
      // El año de la salida que se prepara, no el de hoy ni el del reparto: un
      // reparto en otoño es para la salida del año siguiente.
      const year = PlazoPapeletasService.anioDeLaProcesion(salida);

      // 1. Ya apuntado a esta salida (o ya con su papeleta): lo dice claro.
      if (await tx.papeletaSitio.findUnique({ where: { hermanoId_year_salidaId: { hermanoId, year, salidaId: salida.id } } })) {
        throw new HttpError(`Ya tiene su papeleta ${deArticulo(articulo, salida.nombre)} de ${year}.`, 409);
      }
      if (await PapeletasService.solicitudPendiente(tx, hermanoId, year, salida.id)) {
        throw new HttpError(`Ya está apuntado ${aArticulo(articulo, salida.nombre)} de ${year}.`, 409);
      }

      // 2. Verificar si ya avisó para otro día de esta salida que no ha pasado (evitar duplicados)
      const avisoPrevio = await tx.cita.findFirst({
        where: {
          hermanoId,
          estado: EstadoCita.RESERVADA,
          turno: { salidaId: salida.id, horaFin: { gte: new Date() } }
        }
      });
      if (avisoPrevio) throw new HttpError('Ya tienes un día reservado.');

      const ocupacion = await tx.cita.count({
        where: { turnoId, estado: EstadoCita.RESERVADA }
      });
      if (ocupacion >= turno.capacidadEstimada) {
        throw new HttpError('Este turno ya ha alcanzado su capacidad máxima.');
      }

      // La cita es única por [hermano, turno]: quien canceló este mismo día y
      // vuelve a pedirlo recupera su cita en vez de chocar con la clave.
      const anterior = await tx.cita.findUnique({
        where: { hermanoId_turnoId: { hermanoId, turnoId } }
      });
      const cita = anterior
        ? await tx.cita.update({ where: { id: anterior.id }, data: { estado: EstadoCita.RESERVADA } })
        : await tx.cita.create({ data: { turnoId, hermanoId, estado: EstadoCita.RESERVADA } });

      // Comprueba dentro que no tenga ya solicitud ni papeleta de esta salida.
      const solicitud = await PapeletasService.crearSolicitudEnTransaccion(tx, {
        hermanoId, salida, year, puesto, donativo, citaId: cita.id, origen: OrigenSolicitud.WEB,
      });
      return { id: cita.id, citaId: cita.id, salida: salida.slug, salidaId: salida.id, solicitudId: solicitud.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await AuditoriaService.log(ACCIONES_AUDITORIA.SOLICITUD_SALIDA_PEDIR, meta ?? { userId }, 'solicitud', resultado.solicitudId, {
      despues: { hermanoId, turnoId, puesto, donativo: donativo ?? null, ...resultado },
    });
    avisarALaMesa({ que: 'inscrito', hermanoId, salidaId: resultado.salidaId });
    return resultado;
  }

  /**
   * Todo lo que necesita la pantalla de Procesión del hermano: cada salida
   * con su plazo y sus días, y por cada ficha de la cuenta las cuotas que
   * tiene por pagar y, por salida, su solicitud (pedida, sin recoger), su
   * papeleta de este año (ya recogida) y la última que tuvo.
   */
  static async getMiEstado(userId: number) {
    const filas = await SalidasService.listar();
    const salidas = await Promise.all(filas.map(async (salida) => ({
      salida: salida.slug,
      salidaId: salida.id,
      nombre: salida.nombre,
      conRopa: salida.conRopa,
      cobro: salida.cobro,
      /** La cuota de la salida; null en las de donativo, donde se da la voluntad. */
      cuotaSalida: cuotaDe(salida),
      indicaciones: salida.indicaciones,
      abierto: salida.plazoAbierto,
      year: PlazoPapeletasService.anioDeLaProcesion(salida),
      /** Día, hora de entrada y acceso: los que lleva la papeleta. */
      evento: leerDatosEvento(salida),
      dias: salida.plazoAbierto ? await MiProcesionService.getDiasDisponibles(salida) : [],
    })));
    const porId = new Map(filas.map((s) => [s.id, s]));
    // Una papeleta de una salida ya desactivada es historia: nunca es «de este año».
    const anioDe = (salidaId: number) => salidas.find((x) => x.salidaId === salidaId)?.year ?? Number.NaN;

    const fichas = await db.hermano.findMany({
      where: { userId, fechaBaja: null },
      orderBy: [{ esTitular: 'desc' }, { fechaNacimiento: 'asc' }],
      select: {
        id: true, nombre: true, apellidos: true, esTitular: true, parentesco: true, activo: true,
        tieneTunicaPropia: true, numeroHermano: true,
        solicitudes: {
          where: { estado: EstadoSolicitud.PENDIENTE },
          include: { recibo: true, cita: { select: { id: true, turno: { select: { id: true, salidaId: true, fecha: true, horaInicio: true, horaFin: true } } } } },
          orderBy: { id: 'desc' },
        },
        papeletas: {
          orderBy: { year: 'desc' },
          take: 6,
          select: {
            id: true, year: true, salidaId: true, puesto: true, tramo: true, numero: true, numTunicaAsignada: true,
            recibo: { select: { estado: true, importe: true } },
          },
        },
      },
    });
    const cuotas = await cuotasQueCuentan(db, fichas.map((f) => f.id));
    // El QR de las papeletas de este año, que el hermano enseña en la puerta desde el móvil.
    const deEsteAnio = fichas.flatMap((f) => f.papeletas.filter((p) => p.year === anioDe(p.salidaId)));
    const qrs = new Map(await Promise.all(deEsteAnio.map(async (p) => {
      const codigo = codigoDePapeleta(p.id);
      return [p.id, { codigo, svg: await QRCode.toString(codigo, { type: 'svg', errorCorrectionLevel: 'M', margin: 0 }) }] as const;
    })));

    return {
      salidas,
      pagoEnLinea: pagoEnLineaDisponible(),
      pago: pagoParaLaWeb(),
      fichas: fichas.map(({ solicitudes, papeletas, ...ficha }) => {
        const suyas = cuotas.get(ficha.id) ?? [];
        return {
          ...ficha,
          cuotasPendientes: suyas.filter((c) => c.estado !== EstadoPago.REMESADO),
          cuotasEnElBanco: suyas.filter((c) => c.estado === EstadoPago.REMESADO).length,
          porSalida: Object.fromEntries(salidas.map(({ salida: slug, salidaId, year }) => {
            const salida = porId.get(salidaId)!;
            const s = solicitudes.find((x) => x.salidaId === salidaId && x.year === year) ?? null;
            const p = papeletas.find((x) => x.salidaId === salidaId && x.year === year) ?? null;
            return [slug, {
              solicitud: s && {
                id: s.id, puesto: s.puesto,
                donativo: s.donativo === null ? null : Number(s.donativo),
                /** Lo que falta de la salida (la cuota de salida o la voluntad prometida). */
                pendiente: pendienteDe(s, salida),
                concepto: s.recibo?.concepto ?? conceptoDeSalida(salida, year, []),
                pagada: s.recibo?.estado === EstadoPago.PAGADO,
                cita: s.cita,
              },
              papeleta: p && {
                id: p.id, year: p.year, puesto: p.puesto, tramo: p.tramo, numero: p.numero,
                referencia: referenciaDe(p.year, p.id),
                tunica: p.numTunicaAsignada,
                /** El texto del QR y el QR dibujado (SVG), para la tarjeta de la puerta. */
                qr: qrs.get(p.id) ?? null,
              },
              ultima: papeletas.find((x) => x.salidaId === salidaId && x.year < year) ?? null,
            }];
          })),
        };
      }),
    };
  }

  /**
   * El hermano se echa atrás: se cancela su solicitud y su cita. Si ya pagó
   * la voluntad, la devolución la hace Tesorería: el dinero no se toca desde
   * aquí. Una papeleta ya recogida tampoco se anula desde el área.
   */
  static async cancelarAsistencia(userId: number, citaId: number, meta?: MetaDeAuditoria) {
    // Seguridad: Buscar la cita asegurando que el hermano pertenece al usuario logueado
    const cita = await db.cita.findFirst({
      where: { id: citaId, hermano: { userId } },
      include: { solicitud: { include: { recibo: true } } },
    });

    if (!cita) throw new NotFoundError('Cita no encontrada o no autorizada.');
    if (cita.estado !== EstadoCita.RESERVADA) throw new HttpError('Esta cita ya no se puede cancelar.');

    const solicitud = cita.solicitud;
    if (!solicitud || solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      return await db.cita.update({ where: { id: citaId }, data: { estado: EstadoCita.CANCELADA } });
    }
    if (solicitud.recibo?.estado === EstadoPago.PAGADO) {
      throw new HttpError('Ya está pagada: para anularla y que te devuelvan el dinero, habla con Tesorería.', 409);
    }

    await db.$transaction(async (tx) => PapeletasService.cancelarSolicitudEnTransaccion(tx, solicitud, await idCategoriaDevoluciones()));
    await AuditoriaService.log(ACCIONES_AUDITORIA.SOLICITUD_SALIDA_CANCELAR, meta ?? { userId }, 'solicitud', solicitud.id, {
      origen: 'área de hermanos',
      antes: { hermanoId: solicitud.hermanoId, year: solicitud.year, salidaId: solicitud.salidaId, puesto: solicitud.puesto, citaId },
      despues: { estado: EstadoSolicitud.CANCELADA },
    });
    avisarALaMesa({ que: 'anulado', hermanoId: solicitud.hermanoId, salidaId: solicitud.salidaId });
    return { id: citaId, estado: EstadoCita.CANCELADA };
  }

  /**
   * El hermano ve su historial de salidas (y las de sus hijos).
   */
  static async getMisPapeletas(userId: number, query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    const where = { hermano: { userId } };

    const [data, total] = await db.$transaction([
      db.papeletaSitio.findMany({
        where,
        include: {
          hermano: { select: { nombre: true, apellidos: true } },
          recibo: { select: { estado: true, importe: true } },
          salida: { select: { slug: true, nombre: true } },
        },
        orderBy: [
          { year: 'desc' },
          { salida: { orden: 'asc' } },
          { hermano: { nombre: 'asc' } },
          { id: 'asc' } // Desempate: dos papeletas del mismo año y del mismo hermano —una por
                        // titular y otra por hijo homónimo— saldrían en orden arbitrario y una
                        // podría aparecer en dos páginas y otra en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.papeletaSitio.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }
}
