/**
 * La procesión vista por el hermano desde su área: qué días quedan, avisar de
 * que va a ir, echarse atrás y consultar sus papeletas de otros años.
 *
 * Todo lo de aquí comprueba antes que la ficha sea suya: es la puerta por la
 * que se apuntaría a otro cambiando un número en la petición.
 */
import db from '../../config/db';
import { EstadoCita, Prisma } from '@prisma/client';
import { AvisarAsistenciaDto } from '../../dtos/procesion.dto';
import { HttpError, NotFoundError } from '../../utils/error.handle';
import { transactionWithRetry } from '../../utils/transaction-retry.js';
import { sanearPaginacion, respuestaPaginada } from '../../domain/paginacion.js';

export class MiProcesionService {

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
}
