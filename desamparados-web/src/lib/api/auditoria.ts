import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface AuditEntry {
  id: number
  action: string
  entityType: string | null
  entityId: string | null
  ip: string | null
  createdAt: string
  /**
   * Qué cambió: casi siempre `{ antes, despues }` con los campos tocados, y a
   * veces datos sueltos que explican la operación (`origen`, `totalProcesados`).
   * Los apuntes anteriores a septiembre de 2026 no lo traen.
   */
  detalles?: unknown
  user: { id: number; email: string; nombre: string; apellidos: string; role: string } | null
}

export const registrosDeAuditoria = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<AuditEntry>>(`/admin/audit-logs?${paramsPagina(pagina)}`)
