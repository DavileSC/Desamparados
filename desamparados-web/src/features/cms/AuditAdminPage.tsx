import { useEffect, useState } from 'react'
import { Alert, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { getAuditLogs, type AuditEntry } from '../../lib/api/audit'

export default function AuditAdminPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  useEffect(() => { getAuditLogs().then((result) => setEntries(result.data)).catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se ha podido cargar la auditoría.')).finally(() => setLoading(false)) }, [])
  return <><Helmet><title>Auditoría | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet><Typography variant="h2" component="h1" sx={{ mb: 4 }}>Registro de auditoría</Typography>{error && <Alert severity="error">{error}</Alert>}{loading ? <CircularProgress aria-label="Cargando auditoría" /> : <Stack spacing={2}>{entries.map((entry) => <Paper key={entry.id} sx={{ p: 2 }}><Typography variant="h6">{entry.action}</Typography><Typography variant="body2" color="text.secondary">{entry.user ? `${entry.user.nombre} ${entry.user.apellidos} (${entry.user.role})` : 'Usuario no disponible'} · {new Date(entry.createdAt).toLocaleString('es-ES')}</Typography><Typography variant="body2" color="text.secondary">{entry.entityType ?? 'Sin entidad'}{entry.entityId ? ` #${entry.entityId}` : ''}{entry.ip ? ` · IP ${entry.ip}` : ''}</Typography></Paper>)}{!entries.length && <Alert severity="info">No hay registros de auditoría.</Alert>}</Stack>}</>
}
