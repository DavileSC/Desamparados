import { llamarApi } from './cliente'
import type { BloqueItinerario } from './contenido'

/** Lo que ve la web: la posición solo si está en la calle y es reciente. */
interface CortejoPublico {
  enDirecto: boolean
  lng?: number
  lat?: number
  actualizadoEl?: string
  /** La página cuyo mapa sigue al cortejo (la del primer itinerario con mapa), o `null` si ninguna lo tiene. */
  ruta: string | null
}

/** Lo que ve la Junta: además, si se quedó en marcha sin renovarse y quién la manda. */
export interface CortejoParaLaJunta extends CortejoPublico {
  enMarcha: boolean
  precision: number | null
  autorNombre: string | null
  /** Las paradas y la línea de ese itinerario. */
  recorrido: { paradas: BloqueItinerario['paradas']; linea: [number, number][] } | null
}

export interface PosicionCortejo { lng: number; lat: number; precision: number | null }

export const cortejoEnDirecto = () => llamarApi<CortejoPublico>('/cortejo-directo')
export const cortejoParaLaJunta = () => llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin')
export const enviarPosicion = (p: PosicionCortejo) =>
  llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin', { method: 'PUT', json: p })
export const terminarDirecto = () => llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin/terminar', { method: 'POST' })
