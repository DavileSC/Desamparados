import db from '../config/db';
import { EmailService } from './email.service';
import { GenerarCuotasDto, UpdateReciboDto } from '../dtos/recibo.dto.js';
import { EstadoPago, Prisma, MetodoPago, TipoRecibo } from '@prisma/client';
import { DatosPapeleta } from '../dtos/email.dto.js';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service.js';

export class ReciboService {

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

    if (hermanosActivos.length === 0) throw new Error('No hay hermanos activos.');

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
  static async adminMarcarComoPagado(reciboId: number, meta?: AuditMeta) {

    // 1. Comprobaciones de estado ANTES de tocar nada
    const actual = await db.recibo.findUnique({ where: { id: reciboId } });
    if (!actual) throw new Error('Recibo no encontrado.');
    if (actual.estado === EstadoPago.PAGADO) throw new Error('Este recibo ya estaba pagado.');
    if (actual.estado === EstadoPago.ANULADO) throw new Error('No se puede cobrar un recibo anulado.');
    if (actual.estado === EstadoPago.DEVUELTO) throw new Error('Recibo devuelto por el banco: regenera el cobro antes de marcarlo como pagado.');

    // Auditoría ANTES de mutar: el cobro siempre queda registrado
    AuditService.log(AUDIT_ACTIONS.RECIBO_COBRAR, meta ?? {}, 'recibo', reciboId);

    // 2. Actualización en BD
    const recibo = await db.recibo.update({
      where: { id: reciboId },
      data: {
        estado: EstadoPago.PAGADO,
        fechaPago: new Date()
      },
      include: {
        hermano: {
          include: {
            user: { select: { email: true, nombre: true } }
          }
        }
      }
    });

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

        // --- DATOS ESTÁTICOS DEL EVENTO ---
        fechaSalida: 'Jueves Santo',
        horaSalida: '19:30h',
        accesoPuerta: 'Casa Hermandad (C/ Ejemplo, 1)'
      };

      console.log(`📨 [Cola] Enviando papeleta recibo #${recibo.id} a ${recibo.hermano.user.email}`);

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
    // Auditoría: edición manual de un recibo (cambio de estado/detalles económicos)
    AuditService.log(AUDIT_ACTIONS.RECIBO_ACTUALIZAR, meta ?? {}, 'recibo', reciboId);

    // 1. Actualizar estado del recibo si procede
    if (data.estado) {
      await db.recibo.update({
        where: { id: reciboId },
        data: { estado: data.estado as EstadoPago }
      });
    }

    // 2. Actualizar detalles de la papeleta si procede
    if (data.puesto || data.tramo || data.observaciones) {
      await db.papeletaSitio.updateMany({
        where: { reciboId: reciboId },
        data: {
          puesto: data.puesto,
          tramo: data.tramo,
          observaciones: data.observaciones
        }
      });
    }

    return { message: 'Detalles actualizados' };
  }
}