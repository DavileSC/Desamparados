import type { PublicationItem } from '../../types'
import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface ApiPublication {
  id: number
  titulo: string
  descripcion: string | null
  imagenUrl: string | null
  archivoUrl: string
  fecha: string
  categoria: PublicationItem['category']
  visible: boolean
}

function toPublicationItem(publication: ApiPublication): PublicationItem {
  return {
    id: String(publication.id),
    title: publication.titulo,
    description: publication.descripcion ?? undefined,
    image: publication.imagenUrl ?? undefined,
    fileUrl: publication.archivoUrl,
    date: publication.fecha,
    category: publication.categoria,
  }
}

export async function getLatestPublications() {
  const publications = await apiFetch<ApiPublication[]>('/publications/latest')
  return publications.map(toPublicationItem)
}

export async function getPublications(
  category: PublicationItem['category'] | undefined,
  pagina: { pagina: number; porPagina: number },
): Promise<RespuestaPaginada<PublicationItem>> {
  const path = category ? `/publications/category/${category}` : '/publications'
  const respuesta = await apiFetch<RespuestaPaginada<ApiPublication>>(`${path}?${paramsPagina(pagina)}`)
  return { data: respuesta.data.map(toPublicationItem), meta: respuesta.meta }
}

export function getAdminPublications(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<ApiPublication>>(`/publications/admin?${paramsPagina(pagina)}`)
}

export interface PublicationPayload {
  titulo: string
  descripcion?: string
  imagenUrl?: string
  archivoUrl: string
  fecha?: string
  categoria: PublicationItem['category']
  visible: boolean
}

export function createPublication(payload: PublicationPayload) {
  return apiFetch<ApiPublication>('/publications', { method: 'POST', json: payload })
}

export function updatePublication(id: number, payload: Partial<PublicationPayload>) {
  return apiFetch<ApiPublication>(`/publications/${id}`, { method: 'PUT', json: payload })
}

export function deletePublication(id: number) {
  return apiFetch<{ message: string }>(`/publications/${id}`, { method: 'DELETE' })
}

/**
 * Como en noticias: se pide al servidor por id. Buscarla dentro del listado del
 * CMS dejaba sin editar cualquier publicación fuera de la página cargada.
 */
export function getAdminPublicationById(id: number) {
  return apiFetch<ApiPublication>(`/publications/${id}`)
}
