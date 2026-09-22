import { llamarApi } from './cliente'

export interface ImagenPortada {
  id?: number
  /** Ruta relativa (`/storage/public/…` o `/images/…`), nunca una URL absoluta. */
  url: string
  /** Texto alternativo de la foto; cadena vacía si no se ha escrito. */
  descripcion: string
}

interface ApiImagenPortada {
  id: number
  url: string
  descripcion: string | null
  orden: number
}

export interface TextosPortada {
  hero: { ceja: string; titulo: string; parrafo: string; botonPrincipal: string; enlaceSecundario: string }
  actualidad: { ceja: string; titulo: string; enlace: string }
  agenda: { ceja: string; titulo: string; parrafo: string; enlace: string; directoTitulo: string; directoTexto: string }
  accesos: {
    placa: { ceja: string; titulo: string; texto: string; boton: string }
    teselas: { clave: string; titulo: string; descripcion: string }[]
  }
  sabadoDePasion: { ceja: string; titulo: string; parrafo: string; enlace: string; imagenUrl: string; imagenAlt: string }
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
    imagenes: imagenes.map((i) => ({ id: i.id, url: i.url, descripcion: i.descripcion ?? '' })),
    textos,
  }
}

/** Sustituye la lista entera: la posición en el array es el orden en la portada. */
export function guardarImagenesPortada(imagenes: Pick<ImagenPortada, 'url' | 'descripcion'>[]) {
  return llamarApi<{ message: string; data: ApiImagenPortada[] }>('/portada/imagenes', {
    method: 'PUT',
    json: { imagenes: imagenes.map(({ url, descripcion }) => ({ url, descripcion })) },
  })
}
