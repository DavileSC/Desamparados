/**
 * Las salidas procesionales: filas que define el CMS (el Sábado de Pasión, el
 * Rosario vespertino, las que se añadan). Todo lo de la procesión recibe la
 * fila ya leída, con su acto de la Agenda: de ahí salen su fecha, su cobro,
 * su ropa, sus puestos y su plazo.
 *
 * Las de fecha a mano (`MANUAL`) la toman de un acto de la Agenda que fija
 * Secretaría cada año; ese acto es también de donde la papeleta saca su día,
 * su hora y su lugar (ver `leerDatosEvento`).
 */
import { FechaSalida, Prisma, TipoEvento, type Evento, type Salida } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError } from '../../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { diaMadrid, type ReglaFecha } from '../../domain/fecha-salida.js';

export type SalidaConActo = Salida & { acto: Evento | null };

type Cliente = Prisma.TransactionClient | typeof db;

/** La regla de fecha de una fila, para las funciones puras de `fecha-salida`. */
export function reglaDe(s: SalidaConActo): ReglaFecha {
  if (s.fecha === FechaSalida.PASCUA) return { fecha: 'PASCUA', diasDesdePascua: s.diasDesdePascua ?? 0 };
  return { fecha: 'MANUAL', acto: s.acto ? diaMadrid(s.acto.startDate) : null };
}

/**
 * La salida de una petición: `?salida=<slug>` en las lecturas, `salida` en el
 * cuerpo en las escrituras. Sin ella o si no existe, el 400 de `porSlug`.
 */
export function salidaDe(peticion: { query?: Record<string, unknown>; body?: unknown }): Promise<SalidaConActo> {
  const delCuerpo = (peticion.body as { salida?: unknown } | undefined)?.salida;
  const slug = peticion.query?.salida ?? delCuerpo;
  return SalidasService.porSlug(typeof slug === 'string' ? slug : undefined);
}

export class SalidasService {
  /**
   * La salida de un `?salida=<slug>`. Sin ella no se sabe de qué salida se
   * habla, y antes se suponía la Pasión: con varias salidas, suponer es
   * equivocarse en silencio. Por eso es un 400 y no un valor por defecto.
   */
  static async porSlug(slug: string | undefined, cliente: Cliente = db): Promise<SalidaConActo> {
    const limpio = typeof slug === 'string' ? slug.trim() : '';
    if (!limpio) throw new HttpError('Falta la salida.', 400);
    const salida = await cliente.salida.findUnique({ where: { slug: limpio }, include: { acto: true } });
    if (!salida) throw new HttpError(`No existe la salida «${limpio}».`, 400);
    return salida;
  }

  static async porId(id: number, cliente: Cliente = db): Promise<SalidaConActo> {
    const salida = await cliente.salida.findUnique({ where: { id }, include: { acto: true } });
    if (!salida) throw new HttpError('No existe esa salida.', 400);
    return salida;
  }

  /** Por su orden, y solo las activas salvo que se pidan todas (el CMS). */
  static listar(opciones: { todas?: boolean } = {}): Promise<SalidaConActo[]> {
    return db.salida.findMany({
      where: opciones.todas ? {} : { activa: true },
      include: { acto: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
  }

  /** El acto de la Agenda de una salida a mano, si ya tiene fecha. */
  static fecha(salida: SalidaConActo) {
    const { acto } = salida;
    return acto ? { eventoId: acto.id, inicio: acto.startDate, lugar: acto.location } : null;
  }

  /**
   * Fija (o cambia) la fecha de una salida a mano: crea su acto en la Agenda o
   * mueve el que ya tenía, y lo enlaza a la fila. Las de la Pascua se calculan
   * solas: ponerles fecha a mano dejaría dos fechas que no coinciden.
   */
  static async fijarFecha(salida: SalidaConActo, datos: { inicio: string; lugar?: string | null }, meta?: MetaDeAuditoria) {
    if (salida.fecha !== FechaSalida.MANUAL) {
      throw new HttpError('Esta salida se calcula por la Pascua: su fecha no se pone a mano.', 409);
    }
    const inicio = new Date(datos.inicio);
    if (Number.isNaN(inicio.getTime())) throw new HttpError('La fecha de la salida no es válida.');

    const antes = SalidasService.fecha(salida);
    const acto = {
      title: salida.nombre,
      description: salida.indicaciones,
      location: datos.lugar?.trim() || null,
      startDate: inicio,
      type: TipoEvento.PROCESION,
    };
    const evento = antes
      ? await db.evento.update({ where: { id: antes.eventoId }, data: acto })
      : await db.evento.create({ data: acto });
    await db.salida.update({ where: { id: salida.id }, data: { eventoId: evento.id } });

    await AuditoriaService.log(ACCIONES_AUDITORIA.SALIDA_FECHAR, meta ?? {}, 'salida', salida.id, {
      antes: antes && { eventoId: antes.eventoId, inicio: antes.inicio.toISOString(), lugar: antes.lugar },
      despues: { eventoId: evento.id, inicio: evento.startDate.toISOString(), lugar: evento.location },
    });
    return { eventoId: evento.id, inicio: evento.startDate, lugar: evento.location };
  }
}
