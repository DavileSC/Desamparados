import { llamarApi } from './cliente'

/**
 * Las páginas con documento editable. La misma lista que `SLUGS_CONTENIDO` en
 * el servidor: la portada, con formulario propio, y detrás las que se componen
 * por bloques (las que declara `shared/paginas-publicas.json`).
 */
export type SlugContenido =
  | 'portada' | 'recorrido' | 'historia'
  | 'parroquia' | 'organos-de-gobierno'
  | 'nuestros-fines' | 'caridad' | 'formacion' | 'cultos'
  | 'sabado-de-pasion' | 'trono' | 'enseres'
  | 'desamparados' | 'ajuar'
  | 'agenda' | 'noticias'
  | 'publicaciones' | 'boletines' | 'dossier-prensa'
  | 'contacto'

export interface ParadaRecorrido {
  /** HH:mm, o vacía mientras no se sepa. */
  hora: string
  lugar: string
  /** Dónde cae en el recorrido del mapa, de 0 (salida) a 1 (entrada). Sin ella, se reparte entre sus vecinas. */
  enRuta?: number
}

/** Un punto del mapa: [longitud, latitud], como en GeoJSON. */
export type Coordenada = [number, number]

/**
 * El recorrido sobre el mapa: las esquinas que se pulsaron en el CMS y la línea
 * que sale de ellas (pegada a las calles si `pegado`).
 */
export interface RecorridoEnMapa { esquinas: Coordenada[]; linea: Coordenada[]; pegado: boolean }

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
/**
 * Cómo se ve un bloque: las opciones de `shared/presentacion-de-bloques.json`,
 * comunes y propias de su tipo, más cuatro campos libres. Todo es opcional: lo
 * que falta se pinta como siempre (el primer valor de cada lista). El servidor
 * valida cada opción contra ese mismo catálogo (`domain/presentacion.ts`).
 */
export interface Presentacion {
  [opcion: string]: string | boolean | undefined
  /** Foto del fondo, cuando `fondo` es `foto`. */
  fondoFoto?: string
  /** Para enlazar al bloque: `/historia#fundacion`. */
  ancla?: string
  /** AAAA-MM-DD: el bloque se ve desde ese día (incluido). */
  desde?: string
  /** AAAA-MM-DD: el bloque se ve hasta ese día (incluido). */
  hasta?: string
}

export interface BloqueBase { tipo: string; titulo: string; presentacion?: Presentacion }
export interface BloqueTexto extends BloqueBase { tipo: 'texto'; html: string }
export interface BloqueFoto extends BloqueBase { tipo: 'foto'; url: string; alt: string; pie: string }
/** Los iconos que puede llevar una tarjeta: lista cerrada, la del catálogo compartido. */
export type IconoTarjeta =
  | 'iglesia' | 'corazon' | 'manos' | 'libro' | 'calendario' | 'grupo' | 'lugar' | 'reloj'
  | 'estrella' | 'musica' | 'flor' | 'sol' | 'foto' | 'correo' | 'telefono' | 'info'
export interface TarjetaEnlace {
  titulo: string
  descripcion: string
  enlace: string
  /** Opcionales: una foto arriba de la tarjeta (con su descripción) o un icono. */
  foto?: string
  fotoAlt?: string
  icono?: IconoTarjeta | ''
}
export interface BloqueTarjetas extends BloqueBase { tipo: 'tarjetas'; tarjetas: TarjetaEnlace[] }
/** Mismos medios que la galería de la Titular, y con las mismas reglas: el
 *  servidor los valida con el esquema compartido `medios.schema.ts`. */
export interface BloqueGaleria extends BloqueBase { tipo: 'galeria'; medios: MedioGaleria[] }
export interface BloqueLlamada extends BloqueBase { tipo: 'llamada'; texto: string; boton: string; enlace: string }
export interface LineaDatos { etiqueta: string; valor: string }
export interface BloqueDatos extends BloqueBase { tipo: 'datos'; lineas: LineaDatos[] }
export interface BloqueItinerario extends BloqueBase {
  tipo: 'itinerario'
  paradas: ParadaRecorrido[]
  /** El recorrido sobre el mapa: solo lo usa la disposición «plano» («Sobre el mapa»). */
  recorrido?: RecorridoEnMapa
}
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
/** Foto a un lado y texto con formato al otro, con un botón opcional (los dos o ninguno). */
export interface BloqueFotoTexto extends BloqueBase {
  tipo: 'fotoTexto'; url: string; alt: string; pie: string; html: string; boton: string; enlace: string
}
export interface BloqueCita extends BloqueBase { tipo: 'cita'; texto: string; autor: string; fuente: string }
/** Un vídeo suelto: las mismas reglas que uno de la galería. */
export interface BloqueVideo extends BloqueBase { tipo: 'video'; url: string; portada: string; alt: string; pie: string }
export interface BotonDeBloque { texto: string; enlace: string; estilo: 'principal' | 'secundario' }
export interface BloqueBotones extends BloqueBase { tipo: 'botones'; botones: BotonDeBloque[] }
export interface PreguntaFrecuente { pregunta: string; respuesta: string }
export interface BloquePreguntas extends BloqueBase { tipo: 'preguntas'; preguntas: PreguntaFrecuente[] }
export interface ArchivoDescarga { titulo: string; descripcion: string; url: string }
export interface BloqueDescargas extends BloqueBase { tipo: 'descargas'; archivos: ArchivoDescarga[] }
/** `indicaciones`: unas líneas para orientarse junto a la dirección (el barrio, la entrada). */
export interface BloqueMapa extends BloqueBase { tipo: 'mapa'; lugar: string; direccion: string; indicaciones?: string }
/** `fecha` es AAAA-MM-DDTHH:mm en hora de Madrid. */
export interface BloqueCuentaAtras extends BloqueBase { tipo: 'cuentaAtras'; fecha: string; texto: string; textoFinal: string }
export interface BloqueEspacio extends BloqueBase { tipo: 'espacio' }
/** Una parte de «foto fija y texto que pasa»: su texto y la foto que se ve mientras se lee. */
export interface PasoFotoFija { titulo: string; texto: string; foto: { url: string; alt: string; pie: string } }
export interface BloqueFotoFija extends BloqueBase { tipo: 'fotoFija'; pasos: PasoFotoFija[] }
/**
 * Una franja de misas: qué días (0 domingo … 6 sábado) y a qué horas (HH:mm).
 * `horasVerano` vacías: en verano valen las de siempre.
 */
export interface FranjaDeMisas { etiqueta: string; dias: number[]; horas: string[]; horasVerano: string[] }
export interface TurnoDeDespacho { dias: number[]; desde: string; hasta: string }
/** El verano, de un día del año a otro (MM-DD); vacío, no hay horario de verano. */
export interface BloqueHorario extends BloqueBase {
  tipo: 'horario'
  misas: FranjaDeMisas[]
  despacho: TurnoDeDespacho[]
  verano: { desde: string; hasta: string }
  lineas: LineaDatos[]
}
/** Los dibujos que sabe trazar la web: lista cerrada, la misma que valida el servidor. */
export type NombreDeDibujo = 'templo' | 'signoPasionista'
/** `foto`: una ilustración que se pinta en lugar del dibujo de líneas (vacía, el dibujo). */
/** Un fin de los tres anillos: su texto y, si se quiere, un botón a su página. */
export interface FinDeAnillo { titulo: string; texto: string; boton: string; enlace: string }
/** Los tres fines entrelazados: siempre tres, uno por anillo; `centro` va en el cruce. */
export interface BloqueAnillos extends BloqueBase { tipo: 'anillos'; centro: string; fines: [FinDeAnillo, FinDeAnillo, FinDeAnillo]; texto: string }
/** Un dato de una puerta: sin valor no se pinta; `copiable`, con botón de copiar. */
export interface DatoDePuerta { etiqueta: string; valor: string; nota: string; copiable: boolean }
/** Uno de los dos paneles: ceja, título, texto, hasta tres datos y un botón opcional. */
export interface Puerta { ceja: string; titulo: string; texto: string; datos: DatoDePuerta[]; boton: string; enlace: string }
/** Dos puertas para dos lectores («Necesito ayuda» / «Quiero ayudar»): siempre dos. */
export interface BloquePuertas extends BloqueBase { tipo: 'puertas'; puertas: [Puerta, Puerta] }
/** Una fila del programa: `mes` 1–12, o 0 si no tiene uno fijo («Cada mes»). */
export interface FilaDePrograma { cuando: string; mes: number; titulo: string; texto: string; boton: string; enlace: string }
/** Los cultos del curso, uno por fila; la web marca sola el próximo. */
export interface BloquePrograma extends BloqueBase { tipo: 'programa'; filas: FilaDePrograma[] }
/** Un cargo de la relación: el nombre puede quedar vacío mientras no se sepa. */
export interface FilaDeRelacion { cargo: string; nombre: string; texto: string; enlace: string }
/** La relación de un órgano de gobierno, con el mandato y una nota arriba. */
export interface BloqueRelacion extends BloqueBase { tipo: 'relacion'; mandato: string; nota: string; filas: FilaDeRelacion[] }
/** Un dato de la cartela de una pieza, como «Año · 1997». */
export interface DatoDePieza { etiqueta: string; valor: string }
/** Una pieza del carrusel: su foto, su familia, su nombre, su historia y su cartela. */
export interface PiezaDeCarrusel {
  familia: string; titulo: string; texto: string
  foto: { url: string; alt: string; pie: string }
  datos: DatoDePieza[]
}
/** Una pieza cada vez, con la foto grande y su explicación al lado. */
export interface BloqueCarrusel extends BloqueBase { tipo: 'carrusel'; piezas: PiezaDeCarrusel[] }
export interface BloqueDibujo extends BloqueBase { tipo: 'dibujo'; dibujo: NombreDeDibujo; html: string; foto?: { url: string; alt: string } }

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
  | BloqueFotoTexto
  | BloqueCita
  | BloqueVideo
  | BloqueBotones
  | BloquePreguntas
  | BloqueDescargas
  | BloqueMapa
  | BloqueCuentaAtras
  | BloqueEspacio
  | BloqueFotoFija
  | BloqueHorario
  | BloqueDibujo
  | BloqueAnillos
  | BloquePuertas
  | BloquePrograma
  | BloqueRelacion
  | BloqueCarrusel

/**
 * `ceja` solo la trae Historia, cuya cabecera tiene diseño propio. `encuadre`,
 * las de cabecera a sangre: qué altura de la foto (0 arriba, 100 abajo) se
 * queda a la vista al recortarla.
 */
export interface CabeceraPagina { ceja?: string; titulo: string; subtitulo: string; foto: string; fotoAlt: string; encuadre?: number }
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

/** El contenido de una página, ya mezclado por el servidor. Se lee sin sesión. */
export const getContenido = <T,>(slug: SlugContenido) => llamarApi<T>(`/contenido/${slug}`)

/** Sustituye el documento entero (CMS). */
export const guardarContenido = (slug: SlugContenido, datos: unknown) =>
  llamarApi<{ message: string; data: unknown }>(`/contenido/${slug}`, { method: 'PUT', json: { datos } })

/** Una versión del historial de una página, sin su documento. */
export interface VersionDePagina {
  id: number
  fecha: string
  /** Quién guardó; vacío en la versión de antes de empezar el historial. */
  autor: string
  /** La publicada ahora (la más reciente). */
  actual: boolean
  titulo: string
  bloques: number
}

/** El historial de una página, de la más nueva a la más antigua (CMS). */
export const versionesDePagina = (slug: SlugContenido) => llamarApi<VersionDePagina[]>(`/contenido/${slug}/versiones`)

/** El documento de una versión, con la forma de ahora (CMS). */
export const versionDePagina = (slug: SlugContenido, id: number) => llamarApi<PaginaDeBloques>(`/contenido/${slug}/versiones/${id}`)

/** Unos bloques con nombre, para ponerlos igual en otra página. */
export interface SeccionGuardada {
  id: number
  nombre: string
  bloques: Bloque[]
  autor: string
  fecha: string
}

export const seccionesGuardadas = () => llamarApi<SeccionGuardada[]>('/secciones')
export const guardarSeccion = (nombre: string, bloques: Bloque[]) =>
  llamarApi<SeccionGuardada>('/secciones', { method: 'POST', json: { nombre, bloques } })
export const borrarSeccion = (id: number) => llamarApi<void>(`/secciones/${id}`, { method: 'DELETE' })

/** Los párrafos de un relato: una línea en blanco separa uno del siguiente. */
export const parrafosDe = (relato: string): string[] =>
  relato.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '')
