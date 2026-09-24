/**
 * Los recibos vistos por el hermano desde su área: los suyos y los de las
 * fichas que tiene a su cargo.
 *
 * Las dos consultas llevan el mismo filtro de familia; sin él, cambiar el
 * número de la URL enseñaría el recibo de cualquier otro hermano.
 */
import db from '../config/db';
import { EstadoPago, MetodoPago } from '@prisma/client';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { esPerdonada, pagoEnLineaDisponible } from '../domain/salidas.js';
import { ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';
import { ZonasService } from './procesion/zonas.service.js';

export class MisRecibosService {

  /**
   * Un recibo suelto de la familia del usuario, con el desglose que no cabe en
   * la fila del listado (tipo, método de pago, las dos fechas).
   *
   * Dos cosas no son de estilo:
   *
   * - El `where` lleva el MISMO filtro de familia que el listado, no un
   *   `findUnique` por id. Sin él, cambiar el número de la URL enseñaría el
   *   recibo de cualquier otro hermano.
   * - Los campos van por `select`, no por `include`: así `observaciones` —el
   *   texto libre de Tesorería, con notas internas— no puede colarse por
   *   descuido en la respuesta.
   */
  static async getReciboFamiliar(userId: number, id: number) {
    const recibo = await db.recibo.findFirst({
      where: { id, hermano: { userId, activo: true } },
      select: {
        id: true,
        year: true,
        concepto: true,
        importe: true,
        tipo: true,
        estado: true,
        fechaEmision: true,
        fechaPago: true,
        metodoPago: true,
        // Solo para saber si se perdonó: el texto no sale de aquí.
        observaciones: true,
        hermano: { select: { nombre: true, apellidos: true, esTitular: true } }
      }
    });

    // 404 y no 403: quien pregunta no tiene por qué saber si el recibo existe.
    if (!recibo) throw new NotFoundError('Recibo no encontrado');
    const { observaciones, ...visible } = recibo;
    return { ...visible, perdonada: esPerdonada(observaciones) };
  }

  /**
   * Los recibos de toda la familia del usuario, en una sola lista plana.
   *
   * La unidad que se pagina es el RECIBO, que es lo que la pantalla enseña por
   * filas: paginar por miembro dejaba el tamaño de página sin acotar nada —
   * veinte miembros arrastran los cientos de recibos que tengan colgando— y
   * hacía que el paginador dijese «3 resultados» encima de una tabla de treinta
   * filas. Cada recibo trae de quién es para poder nombrarlo en su fila.
   */
  static async getRecibosByUsuarioFamilia(userId: number, query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    const where = { hermano: { userId, activo: true } };

    const [data, total] = await db.$transaction([
      db.recibo.findMany({
        where,
        include: {
          // esTitular le vendrá genial al frontend para ponerle una estrellita o algo al gestor
          hermano: { select: { nombre: true, apellidos: true, esTitular: true } }
        },
        orderBy: [
          { year: 'desc' },   // Los dos criterios que antes ordenaban los recibos
          { estado: 'asc' },  // dentro de cada miembro, ahora sobre la lista entera
          { id: 'asc' }       // Desempate: dos recibos del mismo año y estado —la cuota y la
                              // papeleta de dos hijos, por ejemplo— dejarían el orden a merced
                              // de MariaDB y uno saldría en dos páginas y otro en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.recibo.count({ where })
    ]);

    // Las notas de Tesorería no salen al área; solo si la cuota se perdonó.
    return respuestaPaginada(data.map(({ observaciones, ...r }) => ({ ...r, perdonada: esPerdonada(observaciones) })), total, paginacion);
  }

  /**
   * Pagar en línea recibos de la familia: las cuotas pendientes, la
   * papeleta o el donativo. Hoy la pasarela está SIMULADA (ver
   * `pagoEnLineaDisponible`): el cobro se apunta como con tarjeta, igual que
   * en la mesa, y con la misma clave contra dobles cobros.
   */
  static async pagarEnLinea(userId: number, pago: { reciboIds?: number[]; solicitudIds?: number[] }, clave: string | undefined, meta?: MetaDeAuditoria) {
    if (!pagoEnLineaDisponible()) throw new HttpError('El pago en línea todavía no está disponible. Puedes pagar en Secretaría o el día del reparto.', 409);
    const reciboIds = pago.reciboIds ?? [];
    const solicitudIds = pago.solicitudIds ?? [];
    const recibos = await db.recibo.findMany({
      where: { id: { in: reciboIds }, hermano: { userId, activo: true } },
      select: { id: true, estado: true, hermanoId: true, concepto: true },
    });
    const solicitudes = await db.solicitud.findMany({
      where: { id: { in: solicitudIds }, hermano: { userId, activo: true } },
      select: { id: true, hermanoId: true },
    });
    if (recibos.length !== new Set(reciboIds).size || solicitudes.length !== new Set(solicitudIds).size) throw new NotFoundError('Recibo no encontrado');
    const alguno = recibos[0]?.hermanoId ?? solicitudes[0]?.hermanoId;
    if (alguno === undefined) throw new HttpError('No hay nada que pagar.');
    // Un reintento del mismo pago (la respuesta no llegó) devuelve lo que ya se hizo.
    const hecho = clave ? await db.operacionMesa.findUnique({ where: { clave }, select: { clave: true } }) : null;
    const noPagables = hecho ? [] : recibos.filter((r) => r.estado !== EstadoPago.PENDIENTE && r.estado !== EstadoPago.DEVUELTO);
    if (noPagables.length > 0) throw new HttpError(`«${noPagables[0].concepto}» no está pendiente de pago.`, 409);
    return ZonasService.cobrar(
      { hermanoId: alguno, reciboIds, solicitudes: solicitudIds.map((solicitudId) => ({ solicitudId })), metodoPago: MetodoPago.TARJETA },
      clave, meta ?? { userId }, ACCIONES_AUDITORIA.PAGO_EN_LINEA,
    );
  }
}
