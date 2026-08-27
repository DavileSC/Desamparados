import { apiFetch } from './client'

export interface AuditEntry { id: number; action: string; entityType: string | null; entityId: string | null; ip: string | null; createdAt: string; user: { id: number; email: string; nombre: string; apellidos: string; role: string } | null }
export interface AuditResponse { data: AuditEntry[]; meta: { total: number; page: number; limit: number; totalPages: number } }
export const getAuditLogs = () => apiFetch<AuditResponse>('/admin/audit-logs?page=1&limit=200')
