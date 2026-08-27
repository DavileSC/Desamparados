import type { EventItem } from '../../types'
import { apiFetch } from './client'

export interface ApiEvent {
  id: number
  title: string
  description: string | null
  location: string | null
  startDate: string
  endDate: string | null
  visibility: 'public' | 'members_only'
  type: 'CULTO' | 'PROCESION' | 'FORMACION' | 'ENSAYO' | 'REUNION' | 'SOCIAL' | 'OTRO'
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function toEventItem(event: ApiEvent): EventItem {
  const start = new Date(event.startDate)
  const end = event.endDate ? new Date(event.endDate) : null
  const date = end && start.toDateString() !== end.toDateString()
    ? `${formatDate(event.startDate)} - ${formatDate(event.endDate!)}`
    : formatDate(event.startDate)

  return {
    id: String(event.id),
    title: event.title,
    description: event.description ?? '',
    date,
    time: start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    location: event.location ?? undefined,
    highlighted: event.type === 'CULTO' || event.type === 'PROCESION',
  }
}

export async function getPublicEvents(count?: number) {
  const events = await apiFetch<ApiEvent[]>('/events')
  return events.slice(0, count).map(toEventItem)
}

export function getAdminEvents() {
  return apiFetch<ApiEvent[]>('/events')
}

export interface EventPayload {
  title: string
  description?: string
  startDate: string
  endDate?: string | null
  location?: string
  visibility: 'public' | 'members_only'
  type: ApiEvent['type']
}

export function createEvent(payload: EventPayload) {
  return apiFetch<ApiEvent>('/events', { method: 'POST', json: payload })
}

export function updateEvent(id: number, payload: Partial<EventPayload>) {
  return apiFetch<ApiEvent>(`/events/${id}`, { method: 'PUT', json: payload })
}

export function deleteEvent(id: number) {
  return apiFetch<{ message: string }>(`/events/${id}`, { method: 'DELETE' })
}
