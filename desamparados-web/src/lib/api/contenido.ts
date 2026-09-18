import { apiFetch } from './client'

/**
 * Las páginas con documento editable. La misma lista que `SLUGS_CONTENIDO` en
 * el servidor: la portada, con formulario propio, y detrás las que se componen
 * por bloques (las que declara `shared/paginas-publicas.json`).
 */
export type SlugContenido =
  | 'portada' | 'recorrido' | 'historia' | 'titular'
  | 'corporacion' | 'parroquia' | 'organos-de-gobierno'
  | 'nuestros-fines' | 'caridad' | 'formacion' | 'cultos'
  | 'sabado-de-pasion' | 'trono' | 'enseres'
  | 'desamparados' | 'ajuar'
  | 'actualidad' | 'agenda' | 'noticias'
  | 'publicaciones' | 'boletines' | 'dossier-prensa'
  | 'contacto'

export interface ParadaRecorrido { hora: string; lugar: string }

/**
 * Un medio de la galería. `url` es una ruta nuestra si es foto, y la dirección
 * de incrustación ya normalizada (`youtube-nocookie`, `player.vimeo`) si es
 * vídeo: el servidor la valida y la normaliza al guardar, así que aquí no hay
 * ninguna decisión de seguridad que tomar.
 *
 * `portada` solo la usan los vídeos: es la miniatura nuestra que se enseña
 * hasta que alguien pulsa el play, para no llamar a YouTube antes.
 */
export interface MedioGaleria {
  tipo: 'foto' | 'video'
  url: string
  portada: string
  alt: string
  pie: string
}

export interface ContenidoTitular {
  ceja: string
  titulo: string
  subtitulo: string
  galeria: MedioGaleria[]
}

export interface ContenidoRecorrido {
  titulo: string
  subtitulo: string
  introduccion: string
  tituloItinerario: string
  plano: { url: string; alt: string }
  paradas: ParadaRecorrido[]
}

/**
 * Color de un hito de la historia. Cada uno responde a algo de la web: granate
 * es el color que ya lleva el Sábado de Pasión, y dorado marca el punto en el
 * que estamos, como el subrayado del menú.
 */
export type TonoHito = 'ninguno' | 'granate' | 'oro'

export interface HitoHistoria {
  /** Lo que va en serif grande: «Años 50», «1954», «Hoy». */
  periodo: string
  /** Etiqueta bajo el periodo y en el índice de la cabecera. */
  etiqueta: string
  titulo: string
  /** Los párrafos, separados por una línea en blanco. */
  relato: string
  /** Sin `url`, el hito no lleva foto. */
  foto: { url: string; alt: string; pie: string }
  tono: TonoHito
}

/**
 * Un bloque de una página compuesta por bloques (Corporación y, más adelante,
 * las que use el constructor de páginas). Unión discriminada por `tipo`, la
 * misma forma que valida el servidor con su mapa `tipo -> esquema` en
 * `bloques.schema.ts` (nada de uniones arktype con `narrow`, que ahí sí
 * revientan: eso es cosa del servidor, aquí es solo el tipo de TypeScript).
 */
export interface BloqueBase { tipo: string; titulo: string }
export interface BloqueTexto extends BloqueBase { tipo: 'texto'; html: string }
export interface BloqueFoto extends BloqueBase { tipo: 'foto'; url: string; alt: string; pie: string }
export interface TarjetaEnlace { titulo: string; descripcion: string; enlace: string }
export interface BloqueTarjetas extends BloqueBase { tipo: 'tarjetas'; tarjetas: TarjetaEnlace[] }
/** Mismos medios que la galería de la Titular, y con las mismas reglas: el
 *  servidor los valida con el esquema compartido `medios.schema.ts`. */
export interface BloqueGaleria extends BloqueBase { tipo: 'galeria'; medios: MedioGaleria[] }
export interface BloqueLlamada extends BloqueBase { tipo: 'llamada'; texto: string; boton: string; enlace: string }
export interface LineaDatos { etiqueta: string; valor: string }
export interface BloqueDatos extends BloqueBase { tipo: 'datos'; lineas: LineaDatos[] }
export interface BloqueItinerario extends BloqueBase { tipo: 'itinerario'; paradas: ParadaRecorrido[] }
export interface BloqueCronologia extends BloqueBase { tipo: 'cronologia'; hitos: HitoHistoria[] }
/**
 * De dónde saca sus elementos un bloque de listado. Lista cerrada, la misma que
 * `FUENTES_LISTADO` en `bloques.schema.ts`: cada fuente es una consulta que ya
 * hacía la web antes de que estas páginas se compusieran por bloques.
 */
export type FuenteListado =
  | 'noticias-recientes' | 'agenda-proxima'
  | 'noticias' | 'agenda'
  | 'publicaciones' | 'boletines' | 'dossier'
export interface BloqueListado extends BloqueBase { tipo: 'listado'; fuente: FuenteListado }
export interface BloqueContacto extends BloqueBase { tipo: 'contacto'; tituloDatos: string; lineas: LineaDatos[] }

export type Bloque =
  | BloqueTexto
  | BloqueFoto
  | BloqueGaleria
  | BloqueTarjetas
  | BloqueLlamada
  | BloqueDatos
  | BloqueItinerario
  | BloqueCronologia
  | BloqueListado
  | BloqueContacto

/** `ceja` solo la trae Historia, cuya cabecera tiene diseño propio. */
export interface CabeceraPagina { ceja?: string; titulo: string; subtitulo: string; foto: string; fotoAlt: string }
export interface PaginaDeBloques { cabecera: CabeceraPagina; bloques: Bloque[] }

/**
 * Las claves de react-query de cada documento. Las comparten la página pública,
 * que guarda su caché con ellas, y el CMS, que las invalida tras guardar.
 * Estaban escritas a mano en los dos sitios: si divergían, guardar dejaba de
 * refrescar la página pública y nada fallaba —la página seguía enseñando lo
 * viejo hasta que caducara la caché—. Exportadas de un solo sitio, la
 * divergencia no se puede ni escribir.
 */
export const CLAVE_RECORRIDO = ['contenido', 'recorrido'] as const
export const CLAVE_TITULAR = ['contenido', 'titular'] as const
export const CLAVE_CORPORACION = ['contenido', 'corporacion'] as const

/** El contenido de una página, ya mezclado por el servidor. Se lee sin sesión. */
export const getContenido = <T,>(slug: SlugContenido) => apiFetch<T>(`/contenido/${slug}`)

/** Sustituye el documento entero (CMS). */
export const guardarContenido = (slug: SlugContenido, datos: unknown) =>
  apiFetch<{ message: string; data: unknown }>(`/contenido/${slug}`, { method: 'PUT', json: { datos } })

/** Los párrafos de un relato: una línea en blanco separa uno del siguiente. */
export const parrafosDe = (relato: string): string[] =>
  relato.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '')
