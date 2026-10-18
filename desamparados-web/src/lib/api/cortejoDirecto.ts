import { llamarApi } from './cliente'
import type { BloqueItinerario, CalleDelRecorrido, VarianteDelRecorrido } from './contenido'

/** Lo que ve la web: la posición solo si está en la calle y es reciente. */
interface CortejoPublico {
  enDirecto: boolean
  lng?: number
  lat?: number
  actualizadoEl?: string
  /** La página cuyo mapa sigue al cortejo (la del primer itinerario con mapa), o `null` si ninguna lo tiene. */
  ruta: string | null
  /** Cuál de los dos recorridos de ese itinerario enseña la web, o `null` si no hay itinerario con mapa. */
  enUso: VarianteDelRecorrido | null
}

/** Lo que ve la Junta: además, si se quedó en marcha sin renovarse y quién la manda. */
export interface CortejoParaLaJunta extends CortejoPublico {
  enMarcha: boolean
  precision: number | null
  autorNombre: string | null
  /** Las paradas, la línea y, si las tiene, las calles de ese itinerario. */
  recorrido: { paradas: BloqueItinerario['paradas']; linea: [number, number][]; calles?: CalleDelRecorrido[] } | null
  /** Si el itinerario tiene recorrido alternativo: con él, se cambia de uno a otro desde la calle. */
  hayAlternativo: boolean
}

export interface PosicionCortejo { lng: number; lat: number; precision: number | null }

export const cortejoEnDirecto = () => llamarApi<CortejoPublico>('/cortejo-directo')
export const cortejoParaLaJunta = () => llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin')
export const enviarPosicion = (p: PosicionCortejo) =>
  llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin', { method: 'PUT', json: p })
export const terminarDirecto = () => llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin/terminar', { method: 'POST' })
export const cambiarRecorridoEnUso = (enUso: VarianteDelRecorrido) =>
  llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin/recorrido', { method: 'PUT', json: { enUso } })
