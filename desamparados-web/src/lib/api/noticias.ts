import type { NewsItem } from '../../types'
import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface ApiNews {
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

function toNewsItem(news: ApiNews): NewsItem {
  return {
    id: String(news.id),
    title: news.titulo,
    excerpt: news.extracto ?? '',
    content: news.contenido,
    image: news.imagenUrl ?? undefined,
    category: 'Noticias',
    date: news.fecha,
    slug: news.slug,
    fijada: news.fijada,
  }
}

export async function noticiasDePortada(count?: number) {
  const news = await apiFetch<ApiNews[]>('/news/latest')
  return news.slice(0, count).map(toNewsItem)
}

export async function archivoDeNoticias(pagina: { pagina: number; porPagina: number }) {
  const respuesta = await apiFetch<RespuestaPaginada<ApiNews>>(`/news/archive?${paramsPagina(pagina)}`)
  return { noticias: respuesta.data.map(toNewsItem), meta: respuesta.meta }
}

export async function noticiaPorDireccion(slug: string) {
  const news = await apiFetch<ApiNews>(`/news/${encodeURIComponent(slug)}`)
  return toNewsItem(news)
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
  return apiFetch<RespuestaPaginada<ApiNews> & { resumen: ResumenNoticias }>(
    `/news/admin/archive?${paramsPagina(pagina, { q: filtros.q, estado: filtros.estado || undefined })}`,
  )
}

export interface NewsPayload {
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

export function crearNoticia(payload: NewsPayload) {
  return apiFetch<ApiNews>('/news', { method: 'POST', json: payload })
}

export function actualizarNoticia(id: number, payload: Partial<NewsPayload>) {
  return apiFetch<ApiNews>(`/news/${id}`, { method: 'PUT', json: payload })
}

export function eliminarNoticia(id: number) {
  return apiFetch<{ message: string }>(`/news/${id}`, { method: 'DELETE' })
}

export function noticiaDelCms(id: number) {
  return apiFetch<ApiNews>(`/news/admin/${id}`)
}
