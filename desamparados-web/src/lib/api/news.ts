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
  }
}

export async function getLatestNews(count?: number) {
  const news = await apiFetch<ApiNews[]>('/news/latest')
  return news.slice(0, count).map(toNewsItem)
}

export async function getNewsArchive(pagina: { pagina: number; porPagina: number }) {
  const respuesta = await apiFetch<RespuestaPaginada<ApiNews>>(`/news/archive?${paramsPagina(pagina)}`)
  return { noticias: respuesta.data.map(toNewsItem), meta: respuesta.meta }
}

export async function getNewsBySlug(slug: string) {
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
  /** `ids`: las que la portada enseña ahora, en su orden; `limite`: cuántas enseña. */
  portada: { limite: number; ids: number[] }
}

export function getAdminNews(pagina: { pagina: number; porPagina: number }, filtros: { q?: string; estado?: EstadoNoticia | '' } = {}) {
  return apiFetch<RespuestaPaginada<ApiNews> & { resumen: ResumenNoticias }>(
    `/news/admin/archive?${paramsPagina(pagina, { q: filtros.q, estado: filtros.estado || undefined })}`,
  )
}

/** Cuántas noticias enseña la portada de la web (entre 1 y 20). */
export function setLimitePortada(limite: number) {
  return apiFetch<{ message: string }>('/news/limit', { method: 'POST', json: { limit: limite } })
}

export interface NewsPayload {
  titulo: string
  contenido: string
  extracto?: string
  imagenUrl?: string
  visible: boolean
  fecha?: string
  slug?: string
}

export function createNews(payload: NewsPayload) {
  return apiFetch<ApiNews>('/news', { method: 'POST', json: payload })
}

export function updateNews(id: number, payload: Partial<NewsPayload>) {
  return apiFetch<ApiNews>(`/news/${id}`, { method: 'PUT', json: payload })
}

export function deleteNews(id: number) {
  return apiFetch<{ message: string }>(`/news/${id}`, { method: 'DELETE' })
}

export function getAdminNewsById(id: number) {
  return apiFetch<ApiNews>(`/news/admin/${id}`)
}
