import type { Acto } from '../../types'
import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface ApiEvent {
  id: number
  title: string
  description: string | null
  location: string | null
  startDate: string
  endDate: string | null
  type: 'CULTO' | 'PROCESION' | 'FORMACION' | 'ENSAYO' | 'REUNION' | 'SOCIAL' | 'OTRO'
  /** Solo lo trae el listado del CMS. */
  updatedAt?: string
}

function enTexto(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function aActo(acto: ApiEvent): Acto {
  const inicio = new Date(acto.startDate)
  const fin = acto.endDate ? new Date(acto.endDate) : null
  const fecha = fin && inicio.toDateString() !== fin.toDateString()
    ? `${enTexto(acto.startDate)} - ${enTexto(acto.endDate!)}`
    : enTexto(acto.startDate)

  return {
    id: String(acto.id),
    titulo: acto.title,
    descripcion: acto.description ?? '',
    fecha,
    hora: inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    lugar: acto.location ?? undefined,
    destacado: acto.type === 'CULTO' || acto.type === 'PROCESION',
  }
}

function pedirPagina(pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<ApiEvent>>(`/events?${paramsPagina(pagina)}`)
}

/**
 * Los próximos eventos de la portada y de actualidad: ni paginan ni lo quieren,
 * solo piden los que caben. Recortar en el cliente traía la agenda entera para
 * enseñar cuatro tarjetas, así que el recorte lo hace el servidor con `?limit=`.
 */
export async function traerProximosEventos(cuantos: number): Promise<Acto[]> {
  const respuesta = await llamarApi<RespuestaPaginada<ApiEvent>>(`/events?limit=${cuantos}`)
  return respuesta.data.map(aActo)
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
export async function eventosDelCalendario(
  { desde, hasta, cuantos }: { desde?: Date; hasta?: Date; cuantos: number },
): Promise<EventoCalendario[]> {
  const params = new URLSearchParams({ limit: String(cuantos) })
  if (desde) params.set('from', desde.toISOString())
  if (hasta) params.set('to', hasta.toISOString())
  const respuesta = await llamarApi<RespuestaPaginada<ApiEvent>>(`/events?${params}`)
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
export async function eventosPublicos(pagina: { pagina: number; porPagina: number }) {
  const respuesta = await pedirPagina(pagina)
  return { eventos: respuesta.data.map(aActo), meta: respuesta.meta }
}

/** Las dos pestañas de la agenda del CMS. */
export type PeriodoAgenda = 'proximos' | 'pasados'

/** Búsqueda y filtros del listado de la agenda en el CMS; `''` es «todos». */
export interface FiltrosAgenda {
  q?: string
  tipo?: ApiEvent['type'] | ''
}

/** Lo que el servidor manda con cada página del listado del CMS. */
export interface ResumenAgenda {
  /** Con la misma búsqueda y filtros: las cifras de las pestañas. */
  proximos: number
  pasados: number
  siguiente: { id: number; title: string; startDate: string } | null
  /** Los actos que la portada de la web enseña ahora en su lista. */
  portada: { limite: number; ids: number[] }
}

/**
 * El CMS tiene su propio extremo (`/events/admin`, con sesión y rol): la lectura
 * pública solo enseña desde hoy, y un evento fechado por error en el pasado
 * desaparecía del CMS sin forma de corregirlo ni borrarlo. Trae el evento
 * crudo (id numérico y fechas sin formatear) para editar y borrar. Los pasados llegan del más reciente hacia atrás.
 */
export async function eventosDelCms(pagina: { pagina: number; porPagina: number }, periodo: PeriodoAgenda = 'proximos', filtros: FiltrosAgenda = {}) {
  const respuesta = await llamarApi<RespuestaPaginada<ApiEvent> & { resumen: ResumenAgenda }>(
    `/events/admin?${paramsPagina(pagina, { periodo, q: filtros.q, tipo: filtros.tipo })}`,
  )
  return { eventos: respuesta.data, meta: respuesta.meta, resumen: respuesta.resumen }
}

export interface DatosDeActo {
  title: string
  description?: string
  startDate: string
  endDate?: string | null
  location?: string
  type: ApiEvent['type']
}

export function crearEvento(payload: DatosDeActo) {
  return llamarApi<ApiEvent>('/events', { method: 'POST', json: payload })
}

export function actualizarEvento(id: number, payload: Partial<DatosDeActo>) {
  return llamarApi<ApiEvent>(`/events/${id}`, { method: 'PUT', json: payload })
}

export function eliminarEvento(id: number) {
  return llamarApi<{ message: string }>(`/events/${id}`, { method: 'DELETE' })
}

export function traerEvento(id: number) {
  return llamarApi<ApiEvent>(`/events/${id}`)
}

/** Un acto del calendario del CMS: el de siempre y si lo puso un día de reparto, que se cambia desde Procesión. */
export type EventoDelCalendario = ApiEvent & { reparto: boolean }

/** Lo que el calendario del CMS sabe de hoy: el siguiente acto y los que salen en la portada. */
export type ResumenDeHoy = Pick<ResumenAgenda, 'siguiente' | 'portada'>

/**
 * El mes del calendario del CMS: todos los actos que tocan algún día de la
 * rejilla, de `desde` a `hasta` (la medianoche de este navegador), sin paginar.
 */
export async function calendarioDelCms(desde: Date, hasta: Date, tipo: ApiEvent['type'] | '' = '') {
  const params = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() })
  if (tipo) params.set('tipo', tipo)
  const respuesta = await llamarApi<{ data: EventoDelCalendario[]; resumen: ResumenDeHoy }>(`/events/admin/calendario?${params}`)
  return { eventos: respuesta.data, resumen: respuesta.resumen }
}
