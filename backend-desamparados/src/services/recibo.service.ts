import db from '../config/db';
import { EmailService } from './email.service';
import { GenerarCuotasDto, UpdateReciboDto } from '../dtos/recibo.dto.js';
import { EstadoPago, Prisma, MetodoPago, TipoRecibo, TipoTransaccion } from '@prisma/client';
import { DatosPapeleta } from '../dtos/email.dto.js';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service.js';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { puedeTransicionar } from '../domain/recibo-estados.js';
import { enmascararEmail } from '../utils/log-privacidad.js';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';

export class ReciboService {

  static async getAdminRecibos(query: { page?: unknown; limit?: unknown } = {}, year?: number, estado?: EstadoPago) {
    const paginacion = sanearPaginacion(query);
    const where = {
      ...(year ? { year } : {}),
      ...(estado ? { estado } : {})
    };

    const [data, total] = await db.$transaction([
      db.recibo.findMany({
        where,
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        skip: paginacion.skip,
        take: paginacion.take,
        select: {
          id: true, year: true, concepto: true, importe: true, fechaEmision: true,
          estado: true, fechaPago: true, metodoPago: true, observaciones: true,
          hermano: { select: { id: true, nombre: true, apellidos: true, numeroHermano: true } }
        }
      }),
      db.recibo.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  // =================================================================
  //  1. GENERACIÓN MASIVA (ADMIN)
  // =================================================================
  static async generarCuotaAnual({ year, importe, concepto }: GenerarCuotasDto, meta?: AuditMeta) {
    // 1. Buscamos a los hermanos activos
 const hermanosActivos = await db.hermano.findMany({
      where: { activo: true },
      select: { 
        id: true,
        formaPagoPref: true
      }
    });

    if (hermanosActivos.length === 0) throw new HttpError('No hay hermanos activos.');

    // 2. Buscamos qué hermanos YA TIENEN este recibo exacto
    const recibosExistentes = await db.recibo.findMany({
      where: { year, concepto },
      select: { hermanoId: true }
    });

    // Creamos un Set con los IDs de los que ya lo tienen para buscar ultra-rápido
    const hermanosConRecibo = new Set(recibosExistentes.map(r => r.hermanoId));

    // 3. Filtramos: Solo nos quedamos con los que NO están en el Set
    const hermanosPendientes = hermanosActivos.filter(h => !hermanosConRecibo.has(h.id));

    if (hermanosPendientes.length === 0) {
      return { message: 'Todos los hermanos activos ya tenían generada esta cuota.' };
    }

    const fechaActual = new Date();

    // 4. Mapeamos y generamos de forma inteligente
    const recibosData = hermanosPendientes.map(h => ({
      hermanoId: h.id,
      year: year,
      importe: new Prisma.Decimal(importe),
      concepto: concepto,
      tipo: TipoRecibo.CUOTA_HERMANO,
      estado: EstadoPago.PENDIENTE,

      // A futuro: Si el hermano tiene domiciliación, el recibo nace sabiendo que se pagará así.
      // Si no, se queda en null hasta que vengan a pagarlo en mano.
      metodoPago: h.formaPagoPref === 'DOMICILIACION' ? MetodoPago.DOMICILIACION : undefined,

      createdAt: fechaActual,
      updatedAt: fechaActual
    }));

    const resultado = await db.recibo.createMany({ data: recibosData });

    // Auditoría: movimiento económico masivo
    AuditService.log(AUDIT_ACTIONS.CUOTAS_GENERAR, meta ?? {}, 'recibo', `year:${year}:${resultado.count}`);

    return {
      message: `Proceso completado. Se generaron ${resultado.count} recibos nuevos.`,
      omitidos: hermanosActivos.length - hermanosPendientes.length
    };
  }

  // =================================================================
  //  2. CONSULTA FAMILIAR (PADRE/TUTOR) - AGRUPADA POR MIEMBRO
  // =================================================================

  static async getRecibosByUsuarioFamilia(userId: number) {
    // Le damos la vuelta: Buscamos a los miembros de la familia y anidamos sus recibos
    return await db.hermano.findMany({
      where: {
        userId: userId,
        activo: true
      },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        esTitular: true, // Te lo añado porque al frontend le vendrá genial para ponerle una estrellita o algo al gestor
        recibos: {
          orderBy: [
            { year: 'desc' },
            { estado: 'asc' }
          ]
        }
      },
      orderBy: [
        { esTitular: 'desc' },    // Ponemos al padre/madre/gestor el primero de la lista
        { fechaNacimiento: 'asc' } // Y a los hijos ordenados por edad
      ]
    });
  }

  // =================================================================
  //  3. GESTIÓN INDIVIDUAL (ADMIN/TESORERO)
  // =================================================================

  // Cobrar y emitir papeleta
  static async adminMarcarComoPagado(reciboId: number, metodoPago?: MetodoPago, meta?: AuditMeta) {

    // El cambio condicionado evita que dos cobros concurrentes envíen dos emails
    // o creen dos auditorías para el mismo recibo.
    const actual = await db.recibo.findUnique({ where: { id: reciboId } });
    if (!actual) throw new NotFoundError('Recibo no encontrado.');
    if (actual.estado === EstadoPago.PAGADO) throw new HttpError('Este recibo ya estaba pagado.');
    if (actual.estado === EstadoPago.ANULADO) throw new HttpError('No se puede cobrar un recibo anulado.');
    if (actual.estado === EstadoPago.DEVUELTO) throw new HttpError('Recibo devuelto por el banco: regenera el cobro antes de marcarlo como pagado.');
    if (actual.estado === EstadoPago.EXENTO) throw new HttpError('No se puede cobrar un recibo exento.');

    const recibo = await transactionWithRetry(async (tx) => {
      const result = await tx.recibo.updateMany({
        where: { id: reciboId, estado: EstadoPago.PENDIENTE },
        data: {
          estado: EstadoPago.PAGADO,
          fechaPago: new Date(),
          ...(metodoPago ? { metodoPago } : {})
        }
      });
      if (result.count !== 1) {
        throw new HttpError('El recibo ya no está pendiente de cobro.');
      }

      const updated = await tx.recibo.findUnique({
        where: { id: reciboId },
        include: {
          hermano: {
            include: {
              user: { select: { email: true, nombre: true } }
            }
          }
        }
      });
      if (!updated) throw new NotFoundError('Recibo no encontrado.');

      const categoria = await tx.categoriaTransaccion.findFirst({
        where: { nombre: 'Cuotas y papeletas', tipo: TipoTransaccion.INGRESO }
      }) ?? await tx.categoriaTransaccion.create({
        data: { nombre: 'Cuotas y papeletas', tipo: TipoTransaccion.INGRESO }
      });

      await tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.INGRESO,
          categoriaId: categoria.id,
          concepto: updated.concepto,
          importe: updated.importe,
          fecha: updated.fechaPago ?? new Date(),
          metodoPago: updated.metodoPago,
          hermanoId: updated.hermanoId,
          reciboId: updated.id
        }
      });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    AuditService.log(AUDIT_ACTIONS.RECIBO_COBRAR, meta ?? {}, 'recibo', reciboId);

    // 2. Buscamos la papeleta asociada por separado (Más seguro que usar include si la relación no está definida en el Schema)
    const papeleta = await db.papeletaSitio.findFirst({
      where: { reciboId: reciboId }
    });

    if (recibo.hermano.user?.email && papeleta) {

      const datosEmail: DatosPapeleta = {
        year: recibo.year,
        importe: `${Number(recibo.importe).toFixed(2)} €`,
        concepto: recibo.concepto,
        puesto: papeleta.puesto,
        tramo: papeleta.tramo,
        observaciones: papeleta.observaciones,

        // --- DATOS DEL EVENTO ---
        // Configurables por .env: van impresos en la papeleta que recibe cada
        // hermano, así que un valor equivocado se envía y ya no se puede
        // corregir. El valor por defecto de la fecha es el Sabado de Pasion,
        // que es cuando sale este Grupo Parroquial.
        fechaSalida: process.env.PROCESION_FECHA || 'Sábado de Pasión',
        horaSalida: process.env.PROCESION_HORA || '19:30h',
        accesoPuerta: process.env.PROCESION_ACCESO || 'Consultar en secretaría'
      };

      console.log(`📨 [Cola] Enviando papeleta recibo #${recibo.id} a ${enmascararEmail(recibo.hermano.user.email)}`);

      EmailService.enviarPapeleta(
        recibo.hermano.user.email,
        recibo.hermano.nombre,
        datosEmail
      ).catch(error => {
        console.error(`❌ [Error Email] Fallo al enviar papeleta ID ${recibo.id}:`, error);
      });
    }

    return recibo;
  }

  // Actualizar datos de procesión (Puesto, Tramo)
  static async adminUpdateDetalles(reciboId: number, data: UpdateReciboDto, meta?: AuditMeta) {
    const actual = await db.recibo.findUnique({ where: { id: reciboId } });
    if (!actual) throw new NotFoundError('Recibo no encontrado.');

    if (data.estado && data.estado !== actual.estado) {
      // El grafo de transiciones vive en src/domain/recibo-estados.ts para
      // poder probarlo sin base de datos.
      if (!puedeTransicionar(actual.estado, data.estado as EstadoPago)) {
        throw new HttpError(`No se puede cambiar un recibo de ${actual.estado} a ${data.estado}.`);
      }
    }

    // Auditoría: edición manual de un recibo (cambio de estado/detalles económicos)
    AuditService.log(AUDIT_ACTIONS.RECIBO_ACTUALIZAR, meta ?? {}, 'recibo', reciboId);

    await db.$transaction(async (tx) => {
      // El asiento original debe existir antes de registrar un reverso.
      if (data.estado === EstadoPago.DEVUELTO && actual.estado === EstadoPago.PAGADO) {
        // Solo una solicitud concurrente puede ganar la transición PAGADO -> DEVUELTO.
        // Así evitamos generar dos asientos de reverso para el mismo cobro.
        const transition = await tx.recibo.updateMany({
          where: { id: reciboId, estado: EstadoPago.PAGADO },
          data: { estado: EstadoPago.DEVUELTO }
        });
        if (transition.count === 0) {
          const current = await tx.recibo.findUnique({ where: { id: reciboId }, select: { estado: true } });
          if (current?.estado !== EstadoPago.DEVUELTO) {
            throw new HttpError('El estado del recibo ha cambiado. Recarga la ficha e inténtalo de nuevo.');
          }
        }

        const ingresoOriginal = await tx.transaccion.findFirst({
          where: { reciboId, tipo: TipoTransaccion.INGRESO }
        });
        if (!ingresoOriginal) {
          throw new HttpError('No se puede devolver el recibo porque no tiene asiento contable de ingreso.');
        }

        const conceptoReverso = `Reverso contable recibo #${reciboId}`;
        const reversoExistente = await tx.transaccion.findFirst({
          where: { reciboId, tipo: TipoTransaccion.GASTO, concepto: conceptoReverso }
        });

        if (!reversoExistente) {
          const categoria = await tx.categoriaTransaccion.findFirst({
            where: { nombre: 'Devoluciones de recibos', tipo: TipoTransaccion.GASTO }
          }) ?? await tx.categoriaTransaccion.create({
            data: { nombre: 'Devoluciones de recibos', tipo: TipoTransaccion.GASTO }
          });

          await tx.transaccion.create({
            data: {
              tipo: TipoTransaccion.GASTO,
              categoriaId: categoria.id,
              concepto: conceptoReverso,
              importe: actual.importe,
              fecha: new Date(),
              metodoPago: actual.metodoPago,
              hermanoId: actual.hermanoId,
              reciboId
            }
          });
        }
      }

      // Estado y detalles se confirman junto al asiento de reverso.
      if (data.estado && data.estado !== actual.estado) {
        await tx.recibo.update({
          where: { id: reciboId },
          data: { estado: data.estado as EstadoPago }
        });
      }

      if (data.puesto !== undefined || data.tramo !== undefined || data.observaciones !== undefined) {
        await tx.papeletaSitio.updateMany({
          where: { reciboId },
          data: {
            ...(data.puesto !== undefined ? { puesto: data.puesto } : {}),
            ...(data.tramo !== undefined ? { tramo: data.tramo } : {}),
            ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {})
          }
        });
      }
    });

    return { message: 'Detalles actualizados' };
  }
}
