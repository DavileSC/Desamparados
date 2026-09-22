/**
 * La mesa de reparto: lo que hace Secretaría el día que se dan las papeletas.
 * Quién se espera hoy, cuánto cuesta cada papeleta, inscribir y cobrar,
 * anular una devuelta, el listado que se llevan los diputados de tramo y el
 * repaso de quien avisó y no vino.
 *
 * Aquí se mueve dinero del Grupo Parroquial: cada operación deja su rastro en
 * la auditoría y el importe lo calcula siempre el servidor.
 */
import db from '../../config/db';
import { EstadoCita, EstadoPago, Prisma, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { CrearInscripcionManualDto } from '../../dtos/procesion.dto';
import { EmailService } from '../email.service';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import {
  devolverCobroEnTransaccion, idCategoriaDevoluciones, idCategoriaIngresos,
  leerDatosEvento, retirarPapeletaEnTransaccion,
} from '../recibos/comunes.js';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { transactionWithRetry } from '../../utils/transaction-retry.js';
import { enmascararEmail } from '../../utils/log-privacidad.js';
import { puedeTransicionar } from '../../domain/recibo-estados.js';
import {
  PRECIO_ALQUILER_POR_DEFECTO,
  PRECIO_PAPELETA_POR_DEFECTO,
  conceptoPapeleta,
  estadoReciboPapeleta,
  importePapeleta,
  leerPrecio
} from '../../domain/datos-procesion.js';

const NOTA_ANULACION = 'Anulado por devolución de la papeleta de sitio.';

export class PapeletasService {

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
  static async inscribirYFacturar(data: CrearInscripcionManualDto, meta?: MetaDeAuditoria) {
    const yearActual = new Date().getFullYear();

    const hermano = await db.hermano.findUnique({
      where: { id: data.hermanoId, activo: true },
      include: { user: { select: { email: true } } } // Incluimos el email para el paso final
    });
    if (!hermano) throw new NotFoundError('No se encontró al hermano para calcular el importe.');

    const importeFinal = await PapeletasService.calcularImportePapeleta(hermano.tieneTunicaPropia);
    // 0 € nace EXENTO, sin asiento contable: ver estadoReciboPapeleta.
    const estadoRecibo = estadoReciboPapeleta(importeFinal);
    const cobrado = estadoRecibo === EstadoPago.PAGADO;
    // La categoría del ingreso se resuelve antes de abrir la transacción: ver
    // idCategoriaDeRecibos.
    const categoriaIngresosId = cobrado ? await idCategoriaIngresos() : null;

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
    await AuditoriaService.log(ACCIONES_AUDITORIA.INSCRIPCION_FACTURAR, meta ?? {}, 'hermano', data.hermanoId, {
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
      const evento = await leerDatosEvento();
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
  static async anularPapeleta(papeletaId: number, meta?: MetaDeAuditoria) {
    // Si el recibo estaba cobrado hará falta su reverso; la categoría se
    // resuelve antes de abrir la transacción (ver `idCategoriaDeRecibos` en recibos/comunes).
    const categoriaDevolucionesId = await idCategoriaDevoluciones();

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

      // Libera la cita y borra la papeleta (hueco en la procesión y clave [hermano, año]).
      await retirarPapeletaEnTransaccion(tx, recibo.id);

      return { papeleta, recibo, estadoFinal };
    });

    // Auditoría tras confirmar: la anulación implica devolución de dinero.
    const { papeleta, recibo, estadoFinal } = resultado;
    await AuditoriaService.log(ACCIONES_AUDITORIA.PAPELETA_ANULAR, meta ?? {}, 'papeleta', papeletaId, {
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

    await AuditoriaService.log(ACCIONES_AUDITORIA.AUSENCIAS_PROCESAR, meta ?? {}, 'cita', undefined, {
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
}
