import { CrearTurnoDto } from './../dtos/procesion.dto';
import db from '../config/db';
import { EstadoCita, EstadoPago, Prisma, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { AvisarAsistenciaDto, CrearInscripcionManualDto } from '../dtos/procesion.dto';
import { EmailService } from './email.service';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service';
import { ReciboService } from './recibo.service.js';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { enmascararEmail } from '../utils/log-privacidad.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { puedeTransicionar } from '../domain/recibo-estados.js';
import {
  PRECIO_ALQUILER_POR_DEFECTO,
  PRECIO_PAPELETA_POR_DEFECTO,
  conceptoPapeleta,
  estadoReciboPapeleta,
  importePapeleta,
  leerPrecio,
  motivoTurnoInvalido
} from '../domain/datos-procesion.js';

const NOTA_ANULACION = 'Anulado por devolución de la papeleta de sitio.';

/** Un turno en la auditoría, con las fechas en ISO. */
function fotoTurno(t: { fecha: Date; horaInicio: Date; horaFin: Date; capacidadEstimada: number; activo: boolean }) {
  return {
    fecha: t.fecha.toISOString(),
    horaInicio: t.horaInicio.toISOString(),
    horaFin: t.horaFin.toISOString(),
    capacidadEstimada: t.capacidadEstimada,
    activo: t.activo
  };
}

export class ProcesionService {

  // ============================================================
  //  ZONA WEB / APP (Para el Hermano)
  // ============================================================

  /**
   * Obtener días disponibles y cuánta gente va a ir.
   */
  static async getDiasDisponibles() {
    const turnos = await db.turno.findMany({
      where: {
        activo: true,
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
      fecha: t.fecha,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      // Info útil para el usuario: "Hay 15 apuntados"
      genteApuntada: t._count.citas
    }));
  }

  /**
   * El hermano avisa: "Voy a ir este día".
   */
  static async avisarAsistencia(userId: number, { turnoId, hermanoId }: AvisarAsistenciaDto) {

    // 0. BARRERA BOLA: Verificar que este hermano pertenece a este usuario
    const checkPropiedad = await db.hermano.findFirst({
      where: { id: hermanoId, userId: userId, activo: true }
    });
    if (!checkPropiedad) {
      throw new HttpError('No tienes permisos para apuntar a este cofrade.');
    }

    const year = new Date().getFullYear();

    // Todas las comprobaciones y la creación van en la misma transacción
    // serializable. Fuera de ella, dos avisos a la vez (doble clic, o dos
    // dispositivos de la misma familia) pasaban los dos el «Ya tienes un día
    // reservado» y el hermano acababa con dos citas; y el aforo podía
    // rebasarse por lo mismo.
    return await transactionWithRetry(async (tx) => {
      const turno = await tx.turno.findUnique({ where: { id: turnoId } });
      if (!turno || !turno.activo || turno.fecha < new Date()) {
        throw new HttpError('El turno no existe o ya no está disponible.');
      }

      // 1. Verificar si ya tiene papeleta este año
      const yaTienePapeleta = await tx.papeletaSitio.findFirst({
        where: { hermanoId, year }
      });
      if (yaTienePapeleta) throw new HttpError('Ya tienes tu papeleta de este año.');

      // 2. Verificar si ya avisó para otro día (evitar duplicados)
      const avisoPrevio = await tx.cita.findFirst({
        where: {
          hermanoId,
          estado: EstadoCita.RESERVADA,
          turno: { fecha: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
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
      if (anterior) {
        return tx.cita.update({
          where: { id: anterior.id },
          data: { estado: EstadoCita.RESERVADA }
        });
      }

      return tx.cita.create({
        data: { turnoId, hermanoId, estado: EstadoCita.RESERVADA }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * El hermano cancela su cita por si le surge un imprevisto.
   */
  static async cancelarAsistencia(userId: number, citaId: number) {
    // Seguridad: Buscar la cita asegurando que el hermano pertenece al usuario logueado
    const cita = await db.cita.findFirst({
      where: {
        id: citaId,
        hermano: { userId: userId }
      }
    });

    if (!cita) throw new NotFoundError('Cita no encontrada o no autorizada.');
    if (cita.estado !== EstadoCita.RESERVADA) throw new HttpError('Esta cita ya no se puede cancelar.');

    return await db.cita.update({
      where: { id: citaId },
      data: { estado: EstadoCita.CANCELADA }
    });
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
          recibo: { select: { estado: true, importe: true } }
        },
        orderBy: [
          { year: 'desc' },
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


  // ============================================================
  //  ZONA ADMIN (La mesa de reparto)
  // ============================================================

  /**
   * Listado de quién esperamos HOY.
   */
  static async getAsistentesDelDia(fecha: Date) {
    const start = new Date(fecha.setHours(0, 0, 0, 0));
    const end = new Date(fecha.setHours(23, 59, 59, 999));

    return await db.cita.findMany({
      where: {
        turno: { fecha: { gte: start, lte: end } },
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

  /**
   * Precio de la papeleta para un hermano, leído de la configuración.
   *
   * Un precio configurado que no se entiende («treinta», «-5») detiene la
   * inscripción: cobrar el valor por defecto en su lugar es cobrar algo que
   * nadie ha decidido. El valor por defecto solo cuenta si la clave no existe.
   */
  static async calcularImportePapeleta(tieneTunicaPropia: boolean): Promise<number> {
    const [precioBaseConfig, precioAlquilerConfig] = await Promise.all([
      db.configuracion.findUnique({ where: { key: 'precio_papeleta_sitio' } }),
      db.configuracion.findUnique({ where: { key: 'precio_alquiler_tunica' } })
    ]);

    const base = leerPrecio(precioBaseConfig?.value, PRECIO_PAPELETA_POR_DEFECTO);
    if (!base.ok) {
      throw new HttpError(`El precio de la papeleta configurado («${base.crudo}») no es un importe válido. Corrígelo en la configuración antes de inscribir.`, 409);
    }
    const alquiler = leerPrecio(precioAlquilerConfig?.value, PRECIO_ALQUILER_POR_DEFECTO);
    if (!alquiler.ok) {
      throw new HttpError(`El precio del alquiler de túnica configurado («${alquiler.crudo}») no es un importe válido. Corrígelo en la configuración antes de inscribir.`, 409);
    }

    return importePapeleta(base.valor, alquiler.valor, tieneTunicaPropia);
  }

  /**
   * EL NÚCLEO DEL SISTEMA: Inscribir, Cobrar y Dar Ropa.
   * Funciona para gente con cita (pasando citaId) y sin cita (citaId null).
   *
   * El importe lo calcula SIEMPRE el servidor con los precios de la
   * configuración; la mesa no manda ninguno.
   */
  static async inscribirYFacturar(data: CrearInscripcionManualDto, meta?: AuditMeta) {
    const yearActual = new Date().getFullYear();

    const hermano = await db.hermano.findUnique({
      where: { id: data.hermanoId, activo: true },
      include: { user: { select: { email: true } } } // Incluimos el email para el paso final
    });
    if (!hermano) throw new NotFoundError('No se encontró al hermano para calcular el importe.');

    const importeFinal = await ProcesionService.calcularImportePapeleta(hermano.tieneTunicaPropia);
    // 0 € nace EXENTO, sin asiento contable: ver estadoReciboPapeleta.
    const estadoRecibo = estadoReciboPapeleta(importeFinal);
    const cobrado = estadoRecibo === EstadoPago.PAGADO;
    // La categoría del ingreso se resuelve antes de abrir la transacción: ver
    // ReciboService.idCategoriaDeRecibos.
    const categoriaIngresosId = cobrado ? await ReciboService.idCategoriaIngresos() : null;

    // Todo o nada, y serializable: la comprobación de «ya tiene papeleta» va
    // dentro para que dos inscripciones a la vez no la pasen las dos.
    const result = await transactionWithRetry(async (tx) => {
      const existe = await tx.papeletaSitio.findUnique({
        where: { hermanoId_year: { hermanoId: data.hermanoId, year: yearActual } }
      });
      if (existe) throw new HttpError('Este hermano ya tiene papeleta este año.', 409);

      if (data.citaId) {
        const cita = await tx.cita.findUnique({ where: { id: data.citaId } });
        if (!cita || cita.hermanoId !== data.hermanoId) {
          throw new HttpError('La cita no pertenece al hermano indicado.');
        }
        if (cita.estado !== EstadoCita.RESERVADA) {
          throw new HttpError('La cita ya no está disponible para esta inscripción.');
        }
      }

      // Si ya se le anuló una papeleta este año, su recibo sigue ocupando el
      // concepto: la nueva se emite como reemisión (ver conceptoPapeleta).
      const recibosDelAnio = await tx.recibo.findMany({
        where: { hermanoId: data.hermanoId, year: yearActual },
        select: { concepto: true }
      });

      // 1. Crear RECIBO (cobrado en mesa, o exento si la papeleta sale gratis)
      const recibo = await tx.recibo.create({
        data: {
          year: yearActual,
          concepto: conceptoPapeleta(yearActual, recibosDelAnio.map(r => r.concepto)),
          importe: new Prisma.Decimal(importeFinal),
          tipo: TipoRecibo.PAPELETA_SITIO,
          estado: estadoRecibo,
          metodoPago: cobrado ? data.metodoPago : null,
          fechaPago: cobrado ? new Date() : null,
          hermanoId: data.hermanoId
        }
      });

      // 2. Crear PAPELETA (Sitio + Ropa)
      const papeleta = await tx.papeletaSitio.create({
        data: {
          year: yearActual,
          puesto: data.puesto,
          tramo: data.tramo,
          numTunicaAsignada: data.numTunicaAsignada,
          numCapiroteAsignado: data.numCapiroteAsignado,
          observaciones: data.observaciones,

          hermanoId: data.hermanoId,
          reciboId: recibo.id,

          // Si venía con cita, guardamos el link para historial
          citaId: data.citaId ?? undefined
        }
      });

      // 3. El ingreso en contabilidad, solo si hubo dinero.
      if (categoriaIngresosId !== null) {
        await tx.transaccion.create({
          data: {
            tipo: TipoTransaccion.INGRESO,
            categoriaId: categoriaIngresosId,
            concepto: recibo.concepto,
            importe: recibo.importe,
            fecha: recibo.fechaPago ?? new Date(),
            metodoPago: recibo.metodoPago,
            hermanoId: data.hermanoId,
            reciboId: recibo.id
          }
        });
      }

      // 4. Si había cita previa, la cerramos
      if (data.citaId) {
        await tx.cita.update({
          where: { id: data.citaId },
          data: { estado: EstadoCita.ATENDIDA }
        });
      }

      return { recibo, papeleta };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Auditoría: cobro + papeleta (dinero del Grupo Parroquial), ya confirmados.
    await AuditService.log(AUDIT_ACTIONS.INSCRIPCION_FACTURAR, meta ?? {}, 'hermano', data.hermanoId, {
      despues: {
        reciboId: result.recibo.id,
        papeletaId: result.papeleta.id,
        concepto: result.recibo.concepto,
        importe: String(result.recibo.importe),
        estado: result.recibo.estado,
        metodoPago: result.recibo.metodoPago,
        citaId: data.citaId ?? null
      }
    });

    // 5. Enviar Email (Fuera de la transacción), con los mismos datos del
    // evento que el cobro en tesorería.
    if (hermano.user?.email) {
      const evento = await ReciboService.leerDatosEvento();
      EmailService.enviarPapeleta(hermano.user.email, hermano.nombre, {
        year: yearActual,
        concepto: result.recibo.concepto,
        importe: `${importeFinal.toFixed(2)} €`,
        puesto: result.papeleta.puesto,
        tramo: result.papeleta.tramo || '',
        observaciones: result.papeleta.observaciones || '',
        ...evento
      }).catch(console.error);
    }

    return result;
  }

  /**
   * Emergencia: El hermano devuelve la túnica por enfermedad o hubo un error al cobrar.
   *
   * El recibo sigue el grafo de estados como cualquier otro: si estaba
   * cobrado pasa a DEVUELTO con su asiento de reverso (antes se forzaba a
   * ANULADO y el ingreso se quedaba en contabilidad como si el dinero siguiera
   * en caja); si aún no se había cobrado, a ANULADO; si era exento, se queda
   * como está porque no hubo dinero. La papeleta se borra y su recibo se
   * conserva, así que el hermano puede volver a inscribirse: su nuevo recibo
   * sale como reemisión.
   */
  static async anularPapeleta(papeletaId: number, meta?: AuditMeta) {
    // Si el recibo estaba cobrado hará falta su reverso; la categoría se
    // resuelve antes de abrir la transacción (ver ReciboService.idCategoriaDeRecibos).
    const categoriaDevolucionesId = await ReciboService.idCategoriaDevoluciones();

    const resultado = await db.$transaction(async (tx) => {
      const papeleta = await tx.papeletaSitio.findUnique({
        where: { id: papeletaId },
        include: { recibo: true }
      });
      if (!papeleta) throw new NotFoundError('Papeleta no encontrada');

      const recibo = papeleta.recibo;
      const observaciones = [recibo.observaciones, NOTA_ANULACION].filter(Boolean).join(' · ');
      let estadoFinal: EstadoPago = recibo.estado;

      if (recibo.estado === EstadoPago.PAGADO) {
        await ReciboService.devolverCobroEnTransaccion(tx, recibo, categoriaDevolucionesId, observaciones);
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

      // Libera la cita y borra la papeleta (hueco en la procesión y clave [hermano, año]).
      await ReciboService.retirarPapeletaEnTransaccion(tx, recibo.id);

      return { papeleta, recibo, estadoFinal };
    });

    // Auditoría tras confirmar: la anulación implica devolución de dinero.
    const { papeleta, recibo, estadoFinal } = resultado;
    await AuditService.log(AUDIT_ACTIONS.PAPELETA_ANULAR, meta ?? {}, 'papeleta', papeletaId, {
      antes: {
        papeleta: { hermanoId: papeleta.hermanoId, year: papeleta.year, puesto: papeleta.puesto, tramo: papeleta.tramo, citaId: papeleta.citaId },
        recibo: { id: recibo.id, estado: recibo.estado, importe: String(recibo.importe) }
      },
      despues: { papeleta: null, recibo: { id: recibo.id, estado: estadoFinal } }
    });

    return {
      message: estadoFinal === EstadoPago.DEVUELTO && recibo.estado === EstadoPago.PAGADO
        ? 'Papeleta anulada. El cobro queda devuelto con su reverso en contabilidad. Ropa liberada.'
        : 'Papeleta anulada. Ropa liberada.',
      reciboId: recibo.id,
      estadoRecibo: estadoFinal
    };
  }


  // ============================================================
  //  ZONA ADMIN (Listados Finales y Mantenimiento)
  // ============================================================

  /**
   * Genera el censo de la procesión para los diputados de tramo / mayordomos.
   */
  static async getListadoProcesion(year: number) {
    return await db.papeletaSitio.findMany({
      where: {
        year: year,
        // Opcional: Solo traer los que hayan pagado o estén exentos
        // recibo: { estado: { in: [EstadoPago.PAGADO, EstadoPago.EXENTO] } }
      },
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
   * Mantenimiento: Procesa a los hermanos que dijeron que venían pero no lo hicieron.
   * @param fechaLimite Instante hasta el que revisar: cuentan los turnos que ya
   *   habían TERMINADO entonces (el controlador lo calcula con instanteLimiteAusencias).
   * @param esCierreDefinitivo Si es TRUE, limpia las citas sin mandar correos de "vuelve a pedir cita".
   */
  static async procesarAusencias(fechaLimite: Date = new Date(), esCierreDefinitivo: boolean = false, meta?: AuditMeta) {
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
        papeleta: null
      },
      include: {
        hermano: { include: { user: true } },
        turno: true
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

    await AuditService.log(AUDIT_ACTIONS.AUSENCIAS_PROCESAR, meta ?? {}, 'cita', undefined, {
      fechaLimite: fechaLimite.toISOString(),
      cierreDefinitivo: esCierreDefinitivo,
      estadoNuevo,
      citasAfectadas: count,
      citaIds: idsAusentes
    });

    if (count === 0) return { message: 'No hay ausencias pendientes de procesar.', procesadas: 0 };

    // Si es cierre definitivo, cortamos aquí.
    if (esCierreDefinitivo) {
      return { message: `CIERRE DE PLAZO: ${count} citas caducadas han sido canceladas.`, procesadas: count };
    }

    // Solo se escribe a quien de verdad ha quedado como no presentado.
    const marcadas = new Set((await db.cita.findMany({
      where: { id: { in: idsAusentes }, estado: EstadoCita.NO_PRESENTADO },
      select: { id: true }
    })).map(c => c.id));

    for (const cita of ausentes) {
      if (marcadas.has(cita.id) && cita.hermano?.user?.email) {
        const fechaStr = cita.turno.fecha.toLocaleDateString('es-ES');
        // Importante añadir 'await' para que no se sature el servidor si hay 500 emails
        await EmailService.enviarRecordatorioAusencia(
          cita.hermano.user.email,
          cita.hermano.nombre,
          fechaStr
        ).catch(() => console.error(`Error enviando email a ${enmascararEmail(cita.hermano.user.email)}`));
      }
    }

    return { message: `Se han procesado ${count} ausencias. Citas actualizadas a NO_PRESENTADO y correos enviados.`, procesadas: count };
  }

  /**
   * Listar absolutamente todos los turnos para el panel de control de Secretaría.
   * Incluye los pasados, los inactivos y la ocupación real.
   */
  static async getTodosLosTurnos() {
    return await db.turno.findMany({
      orderBy: { fecha: 'desc' },
      include: {
        _count: {
          select: { citas: { where: { estado: EstadoCita.RESERVADA } } }
        }
      }
    });
  }

  /**
   * Crear un nuevo día de reparto en la Casa Grupo Parroquial.
   */
  static async crearTurno(data: CrearTurnoDto, meta?: AuditMeta) {
    // 1. Convertimos los textos (strings) a fechas reales de JavaScript
    const fechaInicio = new Date(data.horaInicio);
    const fechaFin = new Date(data.horaFin);

    // 2. Las horas, del mismo día (de Madrid) que el turno y en orden: procesar
    // ausencias decide por horaFin si el turno ya terminó (ver motivoTurnoInvalido).
    const motivo = motivoTurnoInvalido(data.fecha, fechaInicio, fechaFin);
    if (motivo) throw new HttpError(motivo);

    // 3. Lo guardamos en la base de datos
    const turno = await db.turno.create({
      data: {
        fecha: new Date(data.fecha),
        horaInicio: fechaInicio,
        horaFin: fechaFin,
        capacidadEstimada: data.capacidadEstimada,
        activo: true // Por defecto lo abrimos al crearlo
      }
    });

    await AuditService.log(AUDIT_ACTIONS.TURNO_CREAR, meta ?? {}, 'turno', turno.id, { despues: fotoTurno(turno) });
    return turno;
  }

  /**
   * Modificar un turno existente (Ej: Se pone malo el tesorero y hay que bajar el aforo a la mitad).
   */
  static async actualizarTurno(
    turnoId: number,
    data: { capacidadEstimada?: number, activo?: boolean, horaInicio?: Date, horaFin?: Date },
    meta?: AuditMeta
  ) {
    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundError('Turno no encontrado');

    // Solo actualizamos las horas si nos las envían; se valida el turno tal y
    // como quedaría (la hora nueva con la otra que ya tenía), con las mismas
    // reglas que al crearlo.
    const horaInicio = data.horaInicio ? new Date(data.horaInicio) : undefined;
    const horaFin = data.horaFin ? new Date(data.horaFin) : undefined;
    if (horaInicio || horaFin) {
      const motivo = motivoTurnoInvalido(turno.fecha, horaInicio ?? turno.horaInicio, horaFin ?? turno.horaFin);
      if (motivo) throw new HttpError(motivo);
    }

    const actualizado = await db.turno.update({
      where: { id: turnoId },
      data: {
        capacidadEstimada: data.capacidadEstimada,
        activo: data.activo,
        horaInicio,
        horaFin
      }
    });

    await AuditService.log(AUDIT_ACTIONS.TURNO_ACTUALIZAR, meta ?? {}, 'turno', turnoId, {
      antes: fotoTurno(turno),
      despues: fotoTurno(actualizado)
    });
    return actualizado;
  }

  /**
   * Elimina un día de reparto (Solo si nos hemos equivocado al crearlo y no hay nadie apuntado).
   */
  static async eliminarTurno(turnoId: number, meta?: AuditMeta) {
    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundError('Turno no encontrado');

    const ocupacion = await db.cita.count({ where: { turnoId } });
    if (ocupacion > 0) {
      throw new HttpError('No puedes borrar este día porque ya hay hermanos con cita. Desactívalo en su lugar.');
    }

    const borrado = await db.turno.delete({ where: { id: turnoId } });
    await AuditService.log(AUDIT_ACTIONS.TURNO_ELIMINAR, meta ?? {}, 'turno', turnoId, { antes: fotoTurno(turno) });
    return borrado;
  }

  /**
   * Un miembro de la Junta dice: "Yo voy a cubrir este turno".
   */
  static async apuntarmeATurno(userId: number, turnoId: number) {
    // 1. EL BLINDAJE: ¿Es de la Junta?
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.esJuntaDeGobierno) {
      throw new HttpError('Solo los miembros de la Junta de Gobierno pueden apuntarse a trabajar en los turnos.');
    }

    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundError('Turno no encontrado');

    return await db.turno.update({
      where: { id: turnoId },
      data: { responsables: { connect: { id: userId } } }
    });
  }

  /**
   * Un miembro de la Junta dice: "Al final me ha surgido algo, me borro de este turno".
   */
  static async desapuntarmeDeTurno(userId: number, turnoId: number) {
    return await db.turno.update({
      where: { id: turnoId },
      data: {
        responsables: {
          disconnect: { id: userId }
        }
      }
    });
  }

  /**
   * (MODIFICACIÓN) Ver el calendario completo con la gente que viene a sacar papeleta
   * Y los miembros de la Junta que van a estar trabajando.
   */
  static async getCuadranteTurnos() {
    return await db.turno.findMany({
      orderBy: { fecha: 'asc' },
      include: {
        // Cuántos hermanos de la calle vienen
        _count: {
          select: { citas: { where: { estado: EstadoCita.RESERVADA } } }
        },
        // Qué miembros de la Junta están apuntados para trabajar
        responsables: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            role: true // Muy útil para saber si hay algún TESORERO apuntado para cobrar
          }
        }
      }
    });
  }
}
