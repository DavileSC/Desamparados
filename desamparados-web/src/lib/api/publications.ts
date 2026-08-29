import type { PublicationItem } from '../../types'
import { apiFetch } from './client'

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

export async function getPublications(category?: PublicationItem['category']) {
  const path = category ? `/publications/category/${category}` : '/publications'
  const publications = await apiFetch<ApiPublication[]>(path)
  return publications.map(toPublicationItem)
}

export function getAdminPublications() {
  return apiFetch<ApiPublication[]>('/publications/admin')
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

/** Como en noticias: el listado del CMS es la única vista con los borradores. */
export async function getAdminPublicationById(id: number) {
  const publications = await getAdminPublications()
  const publication = publications.find((item) => item.id === id)
  if (!publication) throw new Error('No se ha encontrado la publicación.')
  return publication
}
