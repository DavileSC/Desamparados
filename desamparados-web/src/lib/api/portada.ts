import { apiFetch } from './client'

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

/** Fotos de la cabecera del inicio, en el orden en que rotan. Se leen sin sesión. */
export async function getImagenesPortada(): Promise<ImagenPortada[]> {
  const lista = await apiFetch<ApiImagenPortada[]>('/portada/imagenes')
  return lista.map((imagen) => ({ id: imagen.id, url: imagen.url, descripcion: imagen.descripcion ?? '' }))
}

/** Sustituye la lista entera: la posición en el array es el orden en la portada. */
export function guardarImagenesPortada(imagenes: Pick<ImagenPortada, 'url' | 'descripcion'>[]) {
  return apiFetch<{ message: string; data: ApiImagenPortada[] }>('/portada/imagenes', {
    method: 'PUT',
    json: { imagenes: imagenes.map(({ url, descripcion }) => ({ url, descripcion })) },
  })
}
