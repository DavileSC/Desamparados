import db from '../config/db';
import { Prisma, TipoEvento } from '@prisma/client';
import { CreateEventDto, UpdateEventDto, EventFilterDto } from '../dtos/agenda.dto';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';

export class AgendaService {

  // =================================================================
  //  1. LECTURA
  // =================================================================

  /**
   * Devuelve `{ data, meta }`. La portada y actualidad siguen pidiendo solo los
   * próximos con `?limit=4` y se quedan con `data`: no paginan, pero leen la
   * misma forma.
   *
   * `page` y `limit` llegan crudos de la consulta; quien decide qué es válido
   * (defecto y tope) es sanearPaginacion.
   */
  static async getEvents(isHermano: boolean, filters: EventFilterDto & { page?: unknown; limit?: unknown }) {
    const paginacion = sanearPaginacion(filters);
    const whereClause: Prisma.EventoWhereInput = {};

    // A) Privacidad
    if (!isHermano) {
      whereClause.visibility = 'public';
    }

    // B) Filtro de Fechas (Mejorado)
    if (filters.from || filters.to) {
      whereClause.startDate = {}; // Inicializamos el objeto

      if (filters.from) {
        whereClause.startDate.gte = new Date(filters.from);
      }
      if (filters.to) {
        whereClause.startDate.lte = new Date(filters.to);
      }
    } else {
      // Comportamiento por defecto: Solo eventos futuros
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      whereClause.startDate = { gte: today };
    }

    // C) NUEVO: Filtro por Tipo (Ej: Ver solo Ensayos)
    if (filters.type) {
      whereClause.type = filters.type;
    }

    const [eventos, total] = await db.$transaction([
      db.evento.findMany({
        where: whereClause,
        orderBy: { startDate: 'asc' },
        skip: paginacion.skip,
        take: paginacion.take,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startDate: true,
          endDate: true,
          visibility: true,
          type: true // <--- Devolvemos el tipo al frontend para que pinte el color
        }
      }),
      db.evento.count({ where: whereClause })
    ]);

    return respuestaPaginada(eventos, total, paginacion);
  }

  static async getEventById(id: number, isHermano: boolean) {
    const event = await db.evento.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Evento no encontrado');

    if (!isHermano && event.visibility === 'members_only') {
      throw new HttpError('No tienes permisos para ver este evento');
    }
    return event;
  }

  // =================================================================
  //  2. GESTIÓN
  // =================================================================

static async createEvent(data: CreateEventDto) {
    const start = new Date(data.startDate);
    const end = data.endDate ? new Date(data.endDate) : null;

    if (end && end < start) {
      throw new HttpError('La fecha de fin no puede ser anterior a la de inicio.');
    }

    return await db.evento.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startDate: start,
        endDate: end,
        visibility: data.visibility,
        type: data.type 
      }
    });
  }

  static async updateEvent(id: number, data: UpdateEventDto) {
    // 1. Buscamos el evento actual para tener las fechas de referencia
    const actual = await db.evento.findUnique({ where: { id } });
    if (!actual) throw new NotFoundError('Evento no encontrado');

    // 2. Calculamos las fechas finales (si viene en data, usamos esa; si no, la que ya tenía)
    const finalStartDate = data.startDate ? new Date(data.startDate) : actual.startDate;
    
    // El manejo del endDate es un poco más tricky por el tema de los nulos
    let finalEndDate = actual.endDate;
    if (data.endDate !== undefined) {
      finalEndDate = data.endDate === null ? null : new Date(data.endDate);
    }

    // 3. Validación de cruce de fechas definitiva
    if (finalEndDate && finalEndDate < finalStartDate) {
      throw new HttpError('La actualización provoca que la fecha de fin sea anterior a la de inicio.');
    }

    return await db.evento.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate === null ? null : (data.endDate ? new Date(data.endDate) : undefined),
        visibility: data.visibility,
        type: data.type 
      }
    });
  }

  static async deleteEvent(id: number) {
    return await db.evento.delete({ where: { id } });
  }
}