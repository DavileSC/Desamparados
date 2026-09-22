import { llamarApi } from './cliente'

/**
 * Quién tiene acceso al CMS y con qué cargo.
 *
 * Todas estas rutas son solo de ADMIN (`adminRoutes` las estrecha con
 * `checkRole(SOLO_ADMIN)`): dar y quitar acceso es repartir privilegios, y no
 * le toca ni al Hermano Mayor.
 */

/** Los cargos que dan acceso al CMS. `USER` es el hermano raso: no entra. */
export const CARGOS_CMS = ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'ALBACERIA', 'REDES'] as const
export type CargoCms = (typeof CARGOS_CMS)[number]

export interface MiembroDelStaff {
  id: number
  email: string
  role: CargoCms
  nombre: string
  apellidos: string
  dni: string
  telefono: string
}

/** Un hermano raso, candidato a recibir un cargo. */
export interface CandidatoACargo {
  id: number
  nombre: string
  apellidos: string
  dni: string
  email: string
}

export const cuentasDeStaff = () => llamarApi<MiembroDelStaff[]>('/admin/staff')

export const buscarCandidatos = (q: string) =>
  llamarApi<CandidatoACargo[]>(`/admin/users/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)

/**
 * Da acceso, o cambia el cargo de quien ya lo tiene. Es la misma ruta: el
 * backend no distingue entre ascender a un hermano raso y mover a un cargo de
 * un puesto a otro.
 *
 * Corta las sesiones abiertas de esa persona, así que el cambio es inmediato.
 */
export const darAcceso = (userId: number, role: CargoCms) =>
  llamarApi<{ message: string }>('/admin/staff/promote', { method: 'POST', json: { userId, role } })

/** Quita el cargo: vuelve a ser hermano raso y sale del CMS al momento. */
export const quitarAcceso = (userId: number) =>
  llamarApi<{ message: string }>('/admin/staff/demote', { method: 'POST', json: { userId } })
