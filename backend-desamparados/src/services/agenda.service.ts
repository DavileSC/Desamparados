import db from '../config/db';
import { Prisma, TipoEvento } from '@prisma/client';
import { CreateEventDto, UpdateEventDto, EventFilterDto, PeriodoAgenda, AdminEventFilterDto, AdminCalendarioDto } from '../dtos/agenda.dto';
import { condicionBusqueda } from '../domain/busqueda-texto.js';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';
import { diaMadridComoIntervalo } from '../domain/contabilidad.js';
import { transactionWithRetry } from '../utils/transaction-retry.js';

/**
 * Los actos que la portada de la web enseña en su lista, sin sesión: los
 * públicos desde hoy, como mucho cinco, y solo los que caen en el mes del
 * próximo acto y el siguiente, que es lo que abarca su calendario
 * (EventsAndLive y AgendaList en el frontend).
 */
export const ACTOS_EN_PORTADA = 5;

/** Los días de atrás que siguen en el calendario suscrito. */
export const DIAS_PASADOS_EN_CALENDARIO = 90;

/** Seis semanas de rejilla y algo de holgura: el calendario del CMS no pide más de una vez. */
export const MAX_DIAS_CALENDARIO = 62;

export function actosEnPortada<E extends { startDate: Date }>(proximosPublicos: E[]): E[] {
  const primero = proximosPublicos[0];
  if (!primero) return [];
  const finVentana = new Date(primero.startDate.getFullYear(), primero.startDate.getMonth() + 2, 1);
  return proximosPublicos.filter((e) => e.startDate < finVentana).slice(0, ACTOS_EN_PORTADA);
}

/** Lo del cartel que trae la petición, con los textos vacíos como null (sin tocar lo que no viene). */
function datosDelCartel(data: Pick<CreateEventDto, 'cartel' | 'dedicatoria' | 'fotoCartel'>) {
  const limpio = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
  return { cartel: data.cartel, dedicatoria: limpio(data.dedicatoria), fotoCartel: limpio(data.fotoCartel) };
}

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
  static async getEvents(filters: EventFilterDto & { page?: unknown; limit?: unknown }) {
    const paginacion = sanearPaginacion(filters);
    const whereClause: Prisma.EventoWhereInput = {};

    // A) Filtro de Fechas (Mejorado)
    if (filters.from || filters.to) {
      whereClause.startDate = {}; // Inicializamos el objeto

      if (filters.from) {
        whereClause.startDate.gte = new Date(filters.from);
      }
      if (filters.to) {
        whereClause.startDate.lte = new Date(filters.to);
      }
    } else {
      // Por defecto, lo que queda desde hoy: lo que empieza hoy o después y lo
      // que ya empezó pero no ha terminado (el segundo día de un triduo).
      // Hoy en Madrid, no en el reloj del servidor (que corre en UTC).
      const today = diaMadridComoIntervalo(new Date()).desde;
      whereClause.OR = [{ startDate: { gte: today } }, { endDate: { gte: today } }];
    }

    // B) Filtro por Tipo (Ej: Ver solo Ensayos)
    if (filters.type) {
      whereClause.type = filters.type;
    }

    const [eventos, total] = await db.$transaction([
      db.evento.findMany({
        where: whereClause,
        // El desempate por id no es adorno: con dos eventos a la misma hora
        // (una misa y un ensayo el mismo dia) MariaDB no garantiza el mismo
        // orden entre la consulta de la pagina 1 y la de la 2, y con skip/take
        // uno saldria repetido y otro no saldria nunca.
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        skip: paginacion.skip,
        take: paginacion.take,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startDate: true,
          endDate: true,
          type: true, // <--- Devolvemos el tipo al frontend para que pinte el color
          cartel: true,
          dedicatoria: true,
          fotoCartel: true,
        }
      }),
      db.evento.count({ where: whereClause })
    ]);

    return respuestaPaginada(eventos, total, paginacion);
  }

  /**
   * El listado del CMS: pasados y futuros. La lectura
   * pública solo enseña desde hoy, y el CMS la usaba: un evento fechado por
   * error en el pasado desaparecía y ya no se podía corregir ni borrar.
   *
   * Los próximos van del más cercano al más lejano; los pasados, del más
   * reciente hacia atrás, que es el que se suele buscar.
   *
   * Con cada página va un resumen: cuántos hay a cada lado de hoy con la misma
   * búsqueda y filtros (las cifras de las pestañas), cuál es el siguiente y
   * qué actos salen ahora en la portada de la web.
   */
  static async getAdminEvents(periodo: PeriodoAgenda, { page, limit, q, tipo }: AdminEventFilterDto) {
    const paginacion = sanearPaginacion({ page, limit });
    const hoy = diaMadridComoIntervalo(new Date()).desde;

    const filtros: Prisma.EventoWhereInput = {
      ...(tipo ? { type: tipo } : {}),
      ...condicionBusqueda(q, ['title', 'description', 'location'] as const),
    };
    const proximos: Prisma.EventoWhereInput = { startDate: { gte: hoy } };
    const pasados: Prisma.EventoWhereInput = { startDate: { lt: hoy } };
    const where: Prisma.EventoWhereInput = { ...filtros, ...(periodo === 'pasados' ? pasados : proximos) };

    const [eventos, total, cuantosProximos, cuantosPasados, siguiente, enPortada] = await db.$transaction([
      db.evento.findMany({
        where,
        // Mismo desempate por id que la lectura pública (ver getEvents).
        orderBy: [{ startDate: periodo === 'pasados' ? 'desc' : 'asc' }, { id: 'asc' }],
        skip: paginacion.skip,
        take: paginacion.take,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startDate: true,
          endDate: true,
          type: true,
          updatedAt: true,
          cartel: true,
        }
      }),
      db.evento.count({ where }),
      db.evento.count({ where: { ...filtros, ...proximos } }),
      db.evento.count({ where: { ...filtros, ...pasados } }),
      db.evento.findFirst({ where: proximos, orderBy: [{ startDate: 'asc' }, { id: 'asc' }], select: { id: true, title: true, startDate: true } }),
      db.evento.findMany({
        where: proximos,
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        take: ACTOS_EN_PORTADA,
        select: { id: true, startDate: true },
      }),
    ]);

    return {
      ...respuestaPaginada(eventos, total, paginacion),
      resumen: {
        proximos: cuantosProximos,
        pasados: cuantosPasados,
        siguiente,
        portada: { limite: ACTOS_EN_PORTADA, ids: actosEnPortada(enPortada).map((e) => e.id) },
      },
    };
  }

  /**
   * El mes del calendario del CMS: los actos que tocan algún día entre `desde`
   * y `hasta` (la rejilla entera, con los días de los meses de al lado), sin
   * paginar. Un triduo que empezó antes de `desde` y sigue dentro también
   * entra: si no, sus últimos días saldrían vacíos.
   *
   * Cada acto dice si lo puso un día de reparto (`reparto`), que se cambia
   * desde Procesión y no desde la Agenda. Con ellos va lo mismo que en el
   * listado sobre hoy: cuál es el siguiente y qué actos salen en la portada.
   */
  static async getAdminCalendario({ desde, hasta, q, tipo }: AdminCalendarioDto) {
    const inicio = new Date(desde);
    const fin = new Date(hasta);
    if (!(fin > inicio)) throw new HttpError('El final del calendario tiene que ir después del principio.');
    if (fin.getTime() - inicio.getTime() > MAX_DIAS_CALENDARIO * 86_400_000) {
      throw new HttpError(`El calendario pide como mucho ${MAX_DIAS_CALENDARIO} días de una vez.`);
    }

    const where: Prisma.EventoWhereInput = {
      ...(tipo ? { type: tipo } : {}),
      ...condicionBusqueda(q, ['title', 'description', 'location'] as const),
      startDate: { lt: fin },
      OR: [{ startDate: { gte: inicio } }, { endDate: { gte: inicio } }],
    };
    const [eventos, resumen] = await Promise.all([
      db.evento.findMany({
        where,
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startDate: true,
          endDate: true,
          type: true,
          updatedAt: true,
          cartel: true,
          turno: { select: { id: true } },
        },
      }),
      AgendaService.resumenDeHoy(),
    ]);

    return {
      data: eventos.map(({ turno, ...evento }) => ({ ...evento, reparto: turno !== null })),
      resumen,
    };
  }

  /** Cuál es el siguiente acto desde hoy y cuáles salen ahora en la portada de la web. */
  private static async resumenDeHoy() {
    const hoy = diaMadridComoIntervalo(new Date()).desde;
    const proximos: Prisma.EventoWhereInput = { startDate: { gte: hoy } };
    const [siguiente, enPortada] = await db.$transaction([
      db.evento.findFirst({ where: proximos, orderBy: [{ startDate: 'asc' }, { id: 'asc' }], select: { id: true, title: true, startDate: true } }),
      db.evento.findMany({
        where: proximos,
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        take: ACTOS_EN_PORTADA,
        select: { id: true, startDate: true },
      }),
    ]);
    return { siguiente, portada: { limite: ACTOS_EN_PORTADA, ids: actosEnPortada(enPortada).map((e) => e.id) } };
  }

  /**
   * Lo que va en el calendario de quien se suscribe: todo lo que viene y lo
   * de los últimos tres meses, para que un acto recién pasado no desaparezca
   * de su móvil nada más celebrarse.
   */
  static async getActosDelCalendario() {
    const desde = new Date(Date.now() - DIAS_PASADOS_EN_CALENDARIO * 24 * 60 * 60 * 1000);
    return db.evento.findMany({
      where: { OR: [{ startDate: { gte: desde } }, { endDate: { gte: desde } }] },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      take: 1000,
    });
  }

  static async getEventById(id: number) {
    const event = await db.evento.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundError('Evento no encontrado');
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
        type: data.type,
        ...datosDelCartel(data),
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

    const actualizado = await db.evento.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate === null ? null : (data.endDate ? new Date(data.endDate) : undefined),
        type: data.type,
        ...datosDelCartel(data),
      }
    });
    // La foto del cartel que se cambia o se quita se borra del servidor si
    // nada más la usa, como la de una noticia.
    await borrarSubidasHuerfanas(subidasEnTexto(actual.fotoCartel), { conservar: subidasEnTexto(actualizado.fotoCartel) });
    return actualizado;
  }

  static async deleteEvent(id: number) {
    // El acto de una salida es su fecha: borrarlo aquí la dejaba sin fecha
    // (SetNull) sin que la ficha de la salida se enterara. Comprobación y
    // borrado en la misma transacción, para que un «Fijar fecha» a la vez no
    // enlace el acto justo antes de borrarlo.
    const borrado = await transactionWithRetry(async (tx) => {
      const salida = await tx.salida.findFirst({ where: { eventoId: id }, select: { nombre: true } });
      if (salida) {
        throw new HttpError(`Este acto es la fecha de la salida «${salida.nombre}»: cámbiala desde la ficha de la salida, no desde la Agenda.`, 409);
      }
      return tx.evento.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await borrarSubidasHuerfanas(subidasEnTexto(borrado.fotoCartel));
    return borrado;
  }
}