import { llamarApi } from './cliente'

export interface ImagenPortada {
  id?: number
  /** Ruta relativa (`/storage/public/…` o `/images/…`), nunca una URL absoluta. */
  url: string
  /** Texto alternativo de la foto; cadena vacía si no se ha escrito. */
  descripcion: string
  /**
   * Qué parte se queda a la vista en el móvil, donde la cabecera es vertical y
   * la foto se recorta por los lados: de 0 (izquierda) a 100 (derecha). Sin él,
   * ENCUADRE_MOVIL_POR_DEFECTO.
   */
  encuadre?: number
}

/** El encuadre de siempre en el móvil: un poco a la izquierda del centro. */
export const ENCUADRE_MOVIL_POR_DEFECTO = 35

interface ApiImagenPortada {
  id: number
  url: string
  descripcion: string | null
  encuadre: number | null
  orden: number
}

export interface TextosPortada {
  /** `video`: el vídeo de fondo (`/storage/public/….mp4`), o vacío para que roten las fotos. */
  /** `cuentaAtras`: la cuenta atrás hasta la próxima salida; sin el campo (portadas de antes), sale. */
  hero: { ceja: string; titulo: string; parrafo: string; botonPrincipal: string; enlaceSecundario: string; video: string; cuentaAtras?: boolean }
  actualidad: { ceja: string; titulo: string; enlace: string }
  /** `imagenUrl`: la foto velada del fondo; vacía, fondo oscuro liso. */
  agenda: { ceja: string; titulo: string; parrafo: string; enlace: string; imagenUrl: string }
  accesos: {
    placa: { ceja: string; titulo: string; texto: string; boton: string }
    teselas: { clave: string; titulo: string; descripcion: string }[]
  }
  sabadoDePasion: { ceja: string; titulo: string; parrafo: string; enlace: string; destino: string; imagenUrl: string; imagenAlt: string }
  publicaciones: { boton: string; marcaDeAgua: string }
}

export interface Portada {
  imagenes: ImagenPortada[]
  textos: TextosPortada
}

/** Fotos y textos de la portada, de una sola petición. Se leen sin sesión. */
export async function portadaDelInicio(): Promise<Portada> {
  const { imagenes, textos } = await llamarApi<{ imagenes: ApiImagenPortada[]; textos: TextosPortada }>('/portada')
  return {
    imagenes: imagenes.map((i) => ({ id: i.id, url: i.url, descripcion: i.descripcion ?? '', ...(i.encuadre === null ? {} : { encuadre: i.encuadre }) })),
    textos,
  }
}

/** Sustituye la lista entera: la posición en el array es el orden en la portada. */
export function guardarImagenesPortada(imagenes: Pick<ImagenPortada, 'url' | 'descripcion' | 'encuadre'>[]) {
  return llamarApi<{ message: string; data: ApiImagenPortada[] }>('/portada/imagenes', {
    method: 'PUT',
    json: { imagenes: imagenes.map(({ url, descripcion, encuadre }) => ({ url, descripcion, ...(encuadre === undefined ? {} : { encuadre }) })) },
  })
}
