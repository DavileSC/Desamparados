import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

/** El hermano da su ficha (y las de quien cuelga de su cuenta) por revisada. */
export function confirmarFicha() {
  return llamarApi<{ confirmada: true }>('/hermanos/primer-acceso/confirmar', { method: 'POST' })
}

/** «No es de mi familia»: la ficha vuelve a Secretaría. */
export function devolverFichaAjena(id: number) {
  return llamarApi<{ devuelta: true }>(`/hermanos/primer-acceso/fichas/${id}/ajena`, { method: 'POST' })
}

export type EstadoPrimerAcceso = 'sin-invitar' | 'invitado' | 'confirmado'

/** Una cuenta del censo importado, como la ve Secretaría. */
export interface CuentaPrimerAcceso {
  id: number
  nombre: string
  apellidos: string
  email: string
  numeroHermano: number | null
  /** Cuántas fichas cuelgan de ella además de la suya. */
  aCargo: number
  invitadoEn: string | null
  fichaConfirmadaEn: string | null
  /** Su invitación espera turno para salir. */
  enCola: boolean
}

export interface CifrasPrimerAcceso {
  sinInvitar: number
  invitados: number
  confirmados: number
  enCola: number
}

export function listarPrimerAcceso(filtros: { estado?: EstadoPrimerAcceso; q?: string }, pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<CuentaPrimerAcceso> & { cifras: CifrasPrimerAcceso }>(
    `/hermanos/admin/primer-acceso?${paramsPagina(pagina, { estado: filtros.estado, q: filtros.q?.trim() || undefined })}`,
  )
}

/** Sin `ids`, a todos los que faltan; con ellos, solo a esos (reenviar). Los correos salen después. */
export function invitarPrimerAcceso(ids?: number[]) {
  return llamarApi<{ encoladas: number }>('/hermanos/admin/primer-acceso/invitar', { method: 'POST', json: ids ? { ids } : {} })
}
