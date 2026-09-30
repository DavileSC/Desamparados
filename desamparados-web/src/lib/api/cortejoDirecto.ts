import { llamarApi } from './cliente'

/** Lo que ve la web: la posición solo si está en la calle y es reciente. */
export interface CortejoPublico {
  enDirecto: boolean
  lng?: number
  lat?: number
  actualizadoEl?: string
}

/** Lo que ve la Junta: además, si se quedó en marcha sin renovarse y quién la manda. */
export interface CortejoParaLaJunta extends CortejoPublico {
  enMarcha: boolean
  precision: number | null
  autorNombre: string | null
}

export interface PosicionCortejo { lng: number; lat: number; precision: number | null }

export const cortejoEnDirecto = () => llamarApi<CortejoPublico>('/cortejo-directo')
export const cortejoParaLaJunta = () => llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin')
export const enviarPosicion = (p: PosicionCortejo) =>
  llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin', { method: 'PUT', json: p })
export const terminarDirecto = () => llamarApi<CortejoParaLaJunta>('/cortejo-directo/admin/terminar', { method: 'POST' })
