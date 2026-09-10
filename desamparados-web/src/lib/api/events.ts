import type { EventItem } from '../../types'
import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

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

function pedirPagina(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<ApiEvent>>(`/events?${paramsPagina(pagina)}`)
}

/**
 * Los próximos eventos de la portada y de actualidad: ni paginan ni lo quieren,
 * solo piden los que caben. Recortar en el cliente traía la agenda entera para
 * enseñar cuatro tarjetas, así que el recorte lo hace el servidor con `?limit=`.
 */
export async function getProximosEventos(cuantos: number): Promise<EventItem[]> {
  const respuesta = await apiFetch<RespuestaPaginada<ApiEvent>>(`/events?limit=${cuantos}`)
  return respuesta.data.map(toEventItem)
}

/** Un acto como lo necesita el calendario de la portada: fechas reales y tipo, no texto ya formateado. */
export interface EventoCalendario {
  id: string
  title: string
  description: string
  location?: string
  type: ApiEvent['type']
  start: Date
  end: Date | null
}

/**
 * Los actos del calendario de la portada. Sin `desde` el servidor ya devuelve solo
 * los futuros; con `desde` y `hasta` se pide la ventana del mes visible y el siguiente.
 */
export async function getEventosCalendario(
  { desde, hasta, cuantos }: { desde?: Date; hasta?: Date; cuantos: number },
): Promise<EventoCalendario[]> {
  const params = new URLSearchParams({ limit: String(cuantos) })
  if (desde) params.set('from', desde.toISOString())
  if (hasta) params.set('to', hasta.toISOString())
  const respuesta = await apiFetch<RespuestaPaginada<ApiEvent>>(`/events?${params}`)
  return respuesta.data.map(event => ({
    id: String(event.id),
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? undefined,
    type: event.type,
    start: new Date(event.startDate),
    end: event.endDate ? new Date(event.endDate) : null,
  }))
}

/** La agenda pública: tarjetas ya formateadas más el `meta` que pinta el paginador. */
export async function getPublicEvents(pagina: { pagina: number; porPagina: number }) {
  const respuesta = await pedirPagina(pagina)
  return { eventos: respuesta.data.map(toEventItem), meta: respuesta.meta }
}

/**
 * El CMS: mismo extremo, pero con la cookie de sesión también llegan los
 * `members_only`, y la tabla necesita el evento crudo (id numérico, visibilidad
 * y fechas sin formatear) para editar y borrar.
 */
export async function getAdminEvents(pagina: { pagina: number; porPagina: number }) {
  const respuesta = await pedirPagina(pagina)
  return { eventos: respuesta.data, meta: respuesta.meta }
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

export function getEvent(id: number) {
  return apiFetch<ApiEvent>(`/events/${id}`)
}
