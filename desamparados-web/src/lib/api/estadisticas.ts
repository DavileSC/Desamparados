import { llamarApi } from './cliente'

export const CLAVE_ESTADISTICAS = ['estadisticas-de-visitas'] as const

export interface EstadoDelInforme {
  hay: boolean
  /** Cuándo lo rehízo GoAccess por última vez. */
  actualizado: string | null
}

export const estadoDelInforme = () => llamarApi<EstadoDelInforme>('/estadisticas-de-visitas')

/** El informe de GoAccess. Va en un marco: lo sirve la API, aislado y con sesión. */
export const URL_DEL_INFORME = `${(import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')}/estadisticas-de-visitas/informe`
