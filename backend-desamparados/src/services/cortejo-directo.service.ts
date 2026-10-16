import paginas from '../../../shared/paginas-publicas.json' with { type: 'json' };
import db from '../config/db.js';
import { esSlugContenido, mezclarConDefectos, moduloDePagina, porDefecto } from '../domain/contenido.js';
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
export interface RecorridoDelCortejo { ruta: string; paradas: unknown[]; linea: Punto[]; calles: unknown[] }

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
}

interface CortejoParaLaJunta extends CortejoPublico {
  enMarcha: boolean;
  precision: number | null;
  autorNombre: string | null;
  /** Las paradas o las calles, para marcarlas a mano, y la línea, para avisar de «lejos del recorrido». */
  recorrido: Omit<RecorridoDelCortejo, 'ruta'> | null;
}

const ID = 1;

/** El primer itinerario con mapa de un documento, esté donde esté (también dentro de otro bloque). */
export function itinerarioConMapa(documento: unknown): Omit<RecorridoDelCortejo, 'ruta'> | null {
  if (!documento || typeof documento !== 'object') return null;
  if (Array.isArray(documento)) {
    for (const x of documento) {
      const hallado = itinerarioConMapa(x);
      if (hallado) return hallado;
    }
    return null;
  }
  const o = documento as Record<string, unknown>;
  const recorrido = o.recorrido as { linea?: unknown; calles?: unknown } | undefined;
  const linea = recorrido?.linea;
  if (o.tipo === 'itinerario' && Array.isArray(o.paradas) && Array.isArray(linea) && linea.length > 1) {
    return { paradas: o.paradas, linea: linea as Punto[], calles: Array.isArray(recorrido?.calles) ? recorrido.calles : [] };
  }
  return itinerarioConMapa(Object.values(o));
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
    const hallado = itinerarioConMapa(guardado.has(slug) ? mezclarConDefectos(slug, guardado.get(slug)) : porDefecto(slug));
    if (hallado) return { ruta, ...hallado };
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
    if (!fila || !vigente(fila, ahora)) return { enDirecto: false, ruta };
    return { enDirecto: true, lng: Number(fila.lng), lat: Number(fila.lat), actualizadoEl: fila.actualizadoEl.toISOString(), ruta };
  }

  /** Lo que ve la Junta en el CMS: además, si se quedó en marcha sin renovarse y quién la mandaba. */
  static async paraLaJunta(ahora = new Date()): Promise<CortejoParaLaJunta> {
    const [fila, r] = await Promise.all([leer(), recorrido()]);
    const deLaRuta = { ruta: r?.ruta ?? null, recorrido: r ? { paradas: r.paradas, linea: r.linea, calles: r.calles } : null };
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

  /** Se recoge: el mapa vuelve a la reproducción. */
  static async terminar(meta: MetaDeAuditoria): Promise<CortejoParaLaJunta> {
    const { count } = await db.cortejoEnDirecto.updateMany({ where: { id: ID, enMarcha: true }, data: { enMarcha: false } });
    if (count > 0) await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_DIRECTO_TERMINAR, meta, 'cortejoEnDirecto', ID);
    return CortejoDirectoService.paraLaJunta();
  }
}
