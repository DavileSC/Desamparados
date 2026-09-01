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

export function getAdminNews(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<ApiNews>>(`/news/admin/archive?${paramsPagina(pagina)}`)
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
