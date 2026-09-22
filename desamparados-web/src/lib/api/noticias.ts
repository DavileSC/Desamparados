import type { Noticia } from '../../types'
import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface NoticiaDeLaApi {
  id: number
  slug: string
  titulo: string
  extracto: string | null
  contenido: string
  imagenUrl: string | null
  fecha: string
  visible: boolean
  /** La destacada de la portada: va primera y lleva la cinta «Destacada». */
  fijada: boolean
  /** Última vez que se guardó; para decir de un borrador cuándo se tocó. */
  updatedAt?: string
}

function aNoticia(noticia: NoticiaDeLaApi): Noticia {
  return {
    id: String(noticia.id),
    titulo: noticia.titulo,
    extracto: noticia.extracto ?? '',
    contenido: noticia.contenido,
    imagen: noticia.imagenUrl ?? undefined,
    categoria: 'Noticias',
    fecha: noticia.fecha,
    slug: noticia.slug,
    fijada: noticia.fijada,
  }
}

export async function noticiasDePortada(count?: number) {
  const noticias = await llamarApi<NoticiaDeLaApi[]>('/news/latest')
  return noticias.slice(0, count).map(aNoticia)
}

export async function archivoDeNoticias(pagina: { pagina: number; porPagina: number }) {
  const respuesta = await llamarApi<RespuestaPaginada<NoticiaDeLaApi>>(`/news/archive?${paramsPagina(pagina)}`)
  return { noticias: respuesta.data.map(aNoticia), meta: respuesta.meta }
}

export async function noticiaPorDireccion(slug: string) {
  const noticia = await llamarApi<NoticiaDeLaApi>(`/news/${encodeURIComponent(slug)}`)
  return aNoticia(noticia)
}

export type EstadoNoticia = 'publicadas' | 'borradores' | 'incompletas'

/** Lo que acompaña al listado del CMS: cifras del archivo entero y qué sale en la portada. */
export interface ResumenNoticias {
  publicadas: number
  borradores: number
  incompletas: number
  ultimaPublicacion: string | null
  /**
   * `ids`: las que la portada enseña ahora, en su orden; `limite`: cuántas
   * enseña; `fijada`: la destacada a mano, que va primera, o null si la portada
   * va sola por fecha.
   */
  portada: { limite: number; ids: number[]; fijada: number | null }
}

export function noticiasDelCms(pagina: { pagina: number; porPagina: number }, filtros: { q?: string; estado?: EstadoNoticia | '' } = {}) {
  return llamarApi<RespuestaPaginada<NoticiaDeLaApi> & { resumen: ResumenNoticias }>(
    `/news/admin/archive?${paramsPagina(pagina, { q: filtros.q, estado: filtros.estado || undefined })}`,
  )
}

export interface DatosDeNoticia {
  titulo: string
  contenido: string
  extracto?: string
  imagenUrl?: string
  visible: boolean
  /** Solo al editar: destacar es algo que se hace sobre una noticia publicada. */
  fijada?: boolean
  fecha?: string
  slug?: string
}

export function crearNoticia(payload: DatosDeNoticia) {
  return llamarApi<NoticiaDeLaApi>('/news', { method: 'POST', json: payload })
}

export function actualizarNoticia(id: number, payload: Partial<DatosDeNoticia>) {
  return llamarApi<NoticiaDeLaApi>(`/news/${id}`, { method: 'PUT', json: payload })
}

export function eliminarNoticia(id: number) {
  return llamarApi<{ message: string }>(`/news/${id}`, { method: 'DELETE' })
}

export function noticiaDelCms(id: number) {
  return llamarApi<NoticiaDeLaApi>(`/news/admin/${id}`)
}
