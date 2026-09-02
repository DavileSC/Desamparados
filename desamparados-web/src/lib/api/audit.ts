import { apiFetch } from './client'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface AuditEntry { id: number; action: string; entityType: string | null; entityId: string | null; ip: string | null; createdAt: string; user: { id: number; email: string; nombre: string; apellidos: string; role: string } | null }
export const getAuditLogs = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<AuditEntry>>(`/admin/audit-logs?${paramsPagina(pagina)}`)
