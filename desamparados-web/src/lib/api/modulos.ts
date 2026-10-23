import { llamarApi } from './cliente'
import type { ClaveModulo, FichaDeModulo } from '../../domain/modulos'

export const CLAVE_MODULOS = ['modulos'] as const
/** La lista de Sistema → Módulos, con sus datos: la comparten esa pantalla y el asistente. */
export const CLAVE_LISTA = ['modulos', 'cms'] as const

/** Qué módulos están encendidos. Sin sesión: la web lo necesita antes de pintar la barra. */
export const modulosActivos = () => llamarApi<{ activos: ClaveModulo[] }>('/modulos', { auth: false }).then((r) => r.activos)

export interface ModuloDelCms extends FichaDeModulo {
  activo: boolean
  cambiadoEl: string | null
  cambiadoPor: string | null
  /** Cuántos datos tiene («12 productos»): se enseña antes de apagar. */
  datos: { uno: string; que: string; total: number }[]
}
export const modulosDelCms = () => llamarApi<ModuloDelCms[]>('/cms/modulos')

interface ResultadoDeCambio { ok: true; cambiados: ClaveModulo[]; activos: ClaveModulo[] }
/**
 * Encender o apagar. Un 400 llega como ErrorDeApi con `payload.faltan` (lo
 * que habría que encender antes) o `payload.dependientes` (lo que impide apagar).
 */
export const cambiarModulo = (clave: ClaveModulo, activo: boolean, conRequisitos = false) =>
  llamarApi<ResultadoDeCambio>(`/cms/modulos/${clave}`, { method: 'PUT', json: { activo, conRequisitos } })

/** Las listas de un 400 de cambiarModulo, si las trae. */
export function listasDelRechazo(payload: unknown): { faltan: ClaveModulo[]; dependientes: ClaveModulo[] } {
  const p = (payload ?? {}) as { faltan?: unknown; dependientes?: unknown }
  const lista = (v: unknown) => (Array.isArray(v) ? (v as ClaveModulo[]) : [])
  return { faltan: lista(p.faltan), dependientes: lista(p.dependientes) }
}
