/**
 * Los recibos vistos por el hermano desde su área: los suyos y los de las
 * fichas que tiene a su cargo.
 *
 * Las dos consultas llevan el mismo filtro de familia; sin él, cambiar el
 * número de la URL enseñaría el recibo de cualquier otro hermano.
 */
import db from '../config/db';
import { NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';

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
        hermano: { select: { nombre: true, apellidos: true, esTitular: true } }
      }
    });

    // 404 y no 403: quien pregunta no tiene por qué saber si el recibo existe.
    if (!recibo) throw new NotFoundError('Recibo no encontrado');
    return recibo;
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

    return respuestaPaginada(data, total, paginacion);
  }
}
