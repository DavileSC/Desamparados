import paginas from '../../../shared/paginas-publicas.json' with { type: 'json' };
import db from '../config/db.js';
import { esSlugContenido, mezclarConDefectos, moduloDePagina, porDefecto, type SlugContenido } from '../domain/contenido.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { ContenidoService } from './contenido.service.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { ModulosService } from './modulos.service.js';

/**
 * Una posición que lleva este tiempo sin renovarse ya no se enseña como «en
 * directo»: el móvil se ha quedado sin batería o sin cobertura, y un trono
 * clavado en una esquina durante media hora engaña más que la reproducción.
 */
export const CADUCA_MS = 10 * 60 * 1000;

export interface PosicionEnviada { lng: number; lat: number; precision: number | null }

type Punto = [number, number];

/**
 * El itinerario por el que va el cortejo: la página que lo enseña, sus paradas,
 * la línea del mapa y, si las tiene, sus calles (con ellas, la Junta marca a
 * mano por calles y no por paradas).
 */
export interface RecorridoDelCortejo {
  ruta: string;
  slug: SlugContenido;
  paradas: unknown[];
  linea: Punto[];
  calles: unknown[];
  enUso: Variante;
  hayAlternativo: boolean;
}

/** El recorrido de siempre o el alternativo (18-10-2026), por si la salida cambia. */
export type Variante = 'habitual' | 'alternativo';

interface CortejoPublico {
  enDirecto: boolean;
  lng?: number;
  lat?: number;
  actualizadoEl?: string;
  /**
   * La página cuyo mapa sigue al cortejo, o `null` si ninguna tiene un
   * itinerario con mapa. Solo ese mapa pregunta: otro itinerario por el mismo
   * barrio (el del rosario) no debe pintar el trono «en directo».
   */
  ruta: string | null;
  /** Cuál de los dos recorridos enseña la web: si la Junta lo cambia en plena salida, el mapa abierto se recarga. */
  enUso: Variante | null;
}

interface CortejoParaLaJunta extends CortejoPublico {
  enMarcha: boolean;
  precision: number | null;
  autorNombre: string | null;
  /** Las paradas o las calles, para marcarlas a mano, y la línea, para avisar de «lejos del recorrido». */
  recorrido: { paradas: unknown[]; linea: Punto[]; calles: unknown[] } | null;
  /** Si el itinerario tiene recorrido alternativo, para cambiar de uno a otro desde la calle. */
  hayAlternativo: boolean;
}

const ID = 1;

interface Itinerario { paradas?: unknown; recorrido?: { linea?: unknown; calles?: unknown } }
interface BloqueItinerario extends Itinerario { tipo: 'itinerario'; alternativo?: Itinerario; enUso?: unknown }

const conLinea = (i: Itinerario | undefined) => Array.isArray(i?.paradas) && Array.isArray(i.recorrido?.linea) && i.recorrido.linea.length > 1;

/**
 * El primer bloque de itinerario con mapa de un documento, esté donde esté
 * (también dentro de otro bloque). Vale el mapa de cualquiera de sus dos
 * recorridos: aunque el que esté en uso no lo tenga, es el bloque del cortejo.
 */
export function bloqueConMapa(documento: unknown): BloqueItinerario | null {
  if (!documento || typeof documento !== 'object') return null;
  if (Array.isArray(documento)) {
    for (const x of documento) {
      const hallado = bloqueConMapa(x);
      if (hallado) return hallado;
    }
    return null;
  }
  const o = documento as Record<string, unknown>;
  if (o.tipo === 'itinerario' && (conLinea(o) || conLinea(o.alternativo as Itinerario | undefined))) return o as unknown as BloqueItinerario;
  return bloqueConMapa(Object.values(o));
}

/** Cuál de los dos está en uso: el alternativo solo si lo pide y existe. */
export const varianteEnUso = (b: BloqueItinerario): Variante => (b.enUso === 'alternativo' && b.alternativo ? 'alternativo' : 'habitual');

/**
 * El itinerario del cortejo, el del recorrido en uso: sus paradas, la línea y
 * las calles. `null` si no hay bloque con mapa o si el recorrido en uso no
 * tiene línea (el alternativo aún sin dibujar): sin línea no hay dónde poner el trono.
 */
export function itinerarioConMapa(documento: unknown): { paradas: unknown[]; linea: Punto[]; calles: unknown[] } | null {
  const bloque = bloqueConMapa(documento);
  if (!bloque) return null;
  const i = varianteEnUso(bloque) === 'alternativo' ? bloque.alternativo : bloque;
  if (!i || !conLinea(i)) return null;
  const recorrido = i.recorrido!;
  return { paradas: i.paradas as unknown[], linea: recorrido.linea as Punto[], calles: Array.isArray(recorrido.calles) ? recorrido.calles : [] };
}

/**
 * El recorrido del cortejo: el primer itinerario con mapa de las páginas
 * encendidas, en el orden del catálogo. No va fijo a la página «recorrido»
 * de Desamparados, que es de su módulo propio: otra corporación pone el suyo
 * en cualquier página de bloques.
 */
async function buscarRecorrido(): Promise<RecorridoDelCortejo | null> {
  const candidatas = [];
  for (const { slug, ruta } of paginas.paginas) {
    if (!esSlugContenido(slug)) continue;
    const modulo = moduloDePagina(slug);
    if (modulo && !(await ModulosService.activo(modulo))) continue;
    candidatas.push({ slug, ruta });
  }
  const filas = await db.contenidoPagina.findMany({ where: { slug: { in: candidatas.map((c) => c.slug) } }, select: { slug: true, datos: true } });
  const guardado = new Map(filas.map((f) => [f.slug, f.datos]));
  for (const { slug, ruta } of candidatas) {
    const documento = guardado.has(slug) ? mezclarConDefectos(slug, guardado.get(slug)) : porDefecto(slug);
    const bloque = bloqueConMapa(documento);
    if (!bloque) continue;
    const hallado = itinerarioConMapa(documento);
    return {
      ruta, slug, enUso: varianteEnUso(bloque), hayAlternativo: Boolean(bloque.alternativo),
      paradas: hallado?.paradas ?? [], linea: hallado?.linea ?? [], calles: hallado?.calles ?? [],
    };
  }
  return null;
}

/**
 * Guardado un minuto: la web pregunta cada pocos segundos por cada visitante
 * del mapa, y el itinerario no cambia en plena salida. Un cambio en el CMS
 * tarda como mucho eso en notarse.
 */
const GUARDA_RECORRIDO_MS = 60_000;
let recorridoGuardado: { valor: Promise<RecorridoDelCortejo | null>; hasta: number } | null = null;

function recorrido(): Promise<RecorridoDelCortejo | null> {
  const ahora = Date.now();
  if (!recorridoGuardado || recorridoGuardado.hasta <= ahora) {
    const valor = buscarRecorrido();
    recorridoGuardado = { valor, hasta: ahora + GUARDA_RECORRIDO_MS };
    // Un fallo de la base no se queda guardado un minuto.
    valor.catch(() => { if (recorridoGuardado?.valor === valor) recorridoGuardado = null; });
  }
  return recorridoGuardado.valor;
}

const leer = () => db.cortejoEnDirecto.findUnique({ where: { id: ID } });

function vigente(fila: NonNullable<Awaited<ReturnType<typeof leer>>>, ahora: Date) {
  return fila.enMarcha && ahora.getTime() - fila.actualizadoEl.getTime() < CADUCA_MS;
}

export class CortejoDirectoService {
  /** Lo que ve la web: la posición solo si está en marcha y es reciente; nunca quién la manda. */
  static async publico(ahora = new Date()): Promise<CortejoPublico> {
    const [fila, r] = await Promise.all([leer(), recorrido()]);
    const ruta = r?.ruta ?? null;
    const enUso = r?.enUso ?? null;
    if (!fila || !vigente(fila, ahora)) return { enDirecto: false, ruta, enUso };
    return { enDirecto: true, lng: Number(fila.lng), lat: Number(fila.lat), actualizadoEl: fila.actualizadoEl.toISOString(), ruta, enUso };
  }

  /** Lo que ve la Junta en el CMS: además, si se quedó en marcha sin renovarse y quién la mandaba. */
  static async paraLaJunta(ahora = new Date()): Promise<CortejoParaLaJunta> {
    const [fila, r] = await Promise.all([leer(), recorrido()]);
    const deLaRuta = {
      ruta: r?.ruta ?? null,
      enUso: r?.enUso ?? null,
      hayAlternativo: r?.hayAlternativo ?? false,
      recorrido: r && r.linea.length > 1 ? { paradas: r.paradas, linea: r.linea, calles: r.calles } : null,
    };
    if (!fila) return { enDirecto: false, enMarcha: false, precision: null, autorNombre: null, ...deLaRuta };
    return {
      ...deLaRuta,
      enDirecto: vigente(fila, ahora),
      enMarcha: fila.enMarcha,
      lng: Number(fila.lng),
      lat: Number(fila.lat),
      actualizadoEl: fila.actualizadoEl.toISOString(),
      precision: fila.precision,
      autorNombre: fila.autorNombre,
    };
  }

  /**
   * Una posición nueva. La primera de una salida (la fila apagada o sin
   * existir) queda en la auditoría como el comienzo; las demás no, que son
   * cientos por tarde y no dicen nada.
   */
  static async enviar(p: PosicionEnviada, meta: MetaDeAuditoria): Promise<CortejoParaLaJunta> {
    const autor = meta.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true } }) : null;
    const antes = await leer();
    const datos = { enMarcha: true, lng: p.lng, lat: p.lat, precision: p.precision, autorId: meta.userId ?? null, autorNombre: autor?.nombre ?? null, actualizadoEl: new Date() };
    await db.cortejoEnDirecto.upsert({ where: { id: ID }, create: { id: ID, ...datos }, update: datos });
    if (!antes?.enMarcha) await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_DIRECTO_EMPEZAR, meta, 'cortejoEnDirecto', ID);
    return CortejoDirectoService.paraLaJunta();
  }

  /**
   * Cambia el recorrido en uso desde la calle (la lluvia obliga a acortar):
   * se guarda en la página como un cambio más del CMS, con su versión en el
   * historial, para que la web y el directo enseñen el mismo.
   */
  static async cambiarRecorrido(enUso: Variante, meta: MetaDeAuditoria): Promise<CortejoParaLaJunta> {
    const r = await recorrido();
    if (!r) throw new NotFoundError('Ninguna página tiene un itinerario con mapa.');
    const documento = await ContenidoService.leer(r.slug);
    const bloque = bloqueConMapa(documento);
    if (!bloque) throw new NotFoundError('Ninguna página tiene un itinerario con mapa.');
    if (enUso === 'alternativo' && !bloque.alternativo) {
      throw new HttpError('Este itinerario no tiene recorrido alternativo: se prepara en el CMS, en el bloque Itinerario.', 409);
    }
    if (varianteEnUso(bloque) !== enUso) {
      bloque.enUso = enUso;
      await ContenidoService.guardar(r.slug, documento as object, meta.userId);
      await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_DIRECTO_RECORRIDO, meta, 'contenidoPagina', r.slug, { enUso });
    }
    // Lo guardado un minuto ya no vale: el directo tiene que ver el cambio al momento.
    recorridoGuardado = null;
    return CortejoDirectoService.paraLaJunta();
  }

  /** Se recoge: el mapa vuelve a la reproducción. */
  static async terminar(meta: MetaDeAuditoria): Promise<CortejoParaLaJunta> {
    const { count } = await db.cortejoEnDirecto.updateMany({ where: { id: ID, enMarcha: true }, data: { enMarcha: false } });
    if (count > 0) await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_DIRECTO_TERMINAR, meta, 'cortejoEnDirecto', ID);
    return CortejoDirectoService.paraLaJunta();
  }
}
