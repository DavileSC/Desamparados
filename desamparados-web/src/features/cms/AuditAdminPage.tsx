import { useCallback, useEffect, useState } from 'react'
import { Alert, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { getAuditLogs, type AuditEntry } from '../../lib/api/audit'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

export default function AuditAdminPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  const load = useCallback((vigente: () => boolean = () => true) => getAuditLogs({ pagina, porPagina }).then((result) => { if (!vigente()) return; setEntries(result.data); setMeta(result.meta) }), [pagina, porPagina])
  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se ha podido cargar la auditoría.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  return <><Helmet><title>Auditoría | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet><Typography variant="h2" component="h1" sx={{ mb: 4 }}>Registro de auditoría</Typography>{error && <Alert severity="error">{error}</Alert>}{loading ? <CircularProgress aria-label="Cargando auditoría" /> : <Stack spacing={2}>{entries.map((entry) => <Paper key={entry.id} sx={{ p: 2 }}><Typography variant="h6">{entry.action}</Typography><Typography variant="body2" color="text.secondary">{entry.user ? `${entry.user.nombre} ${entry.user.apellidos} (${entry.user.role})` : 'Usuario no disponible'} · {new Date(entry.createdAt).toLocaleString('es-ES')}</Typography><Typography variant="body2" color="text.secondary">{entry.entityType ?? 'Sin entidad'}{entry.entityId ? ` #${entry.entityId}` : ''}{entry.ip ? ` · IP ${entry.ip}` : ''}</Typography></Paper>)}{!entries.length && <Alert severity="info">No hay registros de auditoría.</Alert>}</Stack>}{meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="registro de auditoría" />}</>
}
