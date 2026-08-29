import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import EditIcon from '@mui/icons-material/Edit'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../members/auth/store'
import { approveRequest, getPendingRequests, rejectRequest, searchBrothers, type AdminBrother, type PendingRequest } from '../../lib/api/brothers'

export default function BrothersAdminPage() {
  const role = useAuthStore((state) => state.user?.role ?? 'USER')
  // Dos permisos distintos: la ficha la escribe secretaría (PUT /hermanos/admin/:id),
  // y las altas las admite también el Hermano Mayor.
  const canEdit = role === 'ADMIN' || role === 'SECRETARIA'
  const puedeAdmitirAltas = canEdit || role === 'HERMANO_MAYOR'
  const [params, setParams] = useSearchParams()
  // La vista vive en la URL: así se puede volver a las solicitudes desde una
  // ficha sin perder dónde se estaba.
  const vista = params.get('vista') === 'solicitudes' ? 'solicitudes' : 'censo'
  const [query, setQuery] = useState('')
  const [brothers, setBrothers] = useState<AdminBrother[]>([])
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => Promise.all([searchBrothers(query, role), puedeAdmitirAltas ? getPendingRequests() : Promise.resolve([] as PendingRequest[])])
    .then(([census, pending]) => { setBrothers(census.data); setRequests(pending) }), [puedeAdmitirAltas, query, role])

  useEffect(() => {
    const timer = window.setTimeout(() => load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se ha podido cargar el censo.')).finally(() => setLoading(false)), query ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [load, query])

  const handleRequest = async (request: PendingRequest, approve: boolean) => {
    try { await (approve ? approveRequest(request.id) : rejectRequest(request.id)); await load(); setNotice(approve ? 'Solicitud aprobada correctamente.' : 'Solicitud rechazada correctamente.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido procesar la solicitud.') }
  }

  return <>
    <Helmet><title>Hermanos | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <Typography variant="h2" component="h1" sx={{ mb: 4 }}>Gestión de hermanos</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <Tabs value={vista} onChange={(_, valor) => setParams(valor === 'solicitudes' ? { vista: 'solicitudes' } : {})} sx={{ mb: 3 }}>
      <Tab value="censo" label="Censo" />
      <Tab value="solicitudes" label={`Solicitudes (${requests.length})`} />
    </Tabs>
    {vista === 'solicitudes' ? <Paper sx={{ p: 3 }}><Stack spacing={2}>
      {requests.map((request) => <Box key={request.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}><Box><Typography>{request.nombre} {request.apellidos}</Typography><Typography variant="body2" color="text.secondary">{request.email} · {request.hermanos.length} perfil(es)</Typography></Box><Stack direction="row" spacing={1}><Button variant="contained" onClick={() => handleRequest(request, true)}>Aprobar</Button><Button color="error" onClick={() => handleRequest(request, false)}>Rechazar</Button></Stack></Box>)}
      {requests.length === 0 && <Alert severity="info">No hay solicitudes pendientes.</Alert>}
    </Stack></Paper> : <>
    <TextField label="Buscar por nombre, DNI o email" value={query} onChange={(event) => setQuery(event.target.value)} fullWidth sx={{ mb: 3 }} />
    {loading ? <CircularProgress aria-label="Cargando censo" /> : <Stack spacing={2}>{brothers.map((brother) => <Paper key={brother.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h6">{brother.nombre} {brother.apellidos}</Typography><Typography variant="body2" color="text.secondary">{brother.numeroHermano ? `N.º ${brother.numeroHermano}` : 'Sin número'} · {brother.email ?? brother.user?.email ?? 'Sin email'} · {brother.activo ? 'Activo' : 'Pendiente/inactivo'}</Typography></Box>{canEdit && <Button aria-label={`Editar ${brother.nombre} ${brother.apellidos}`} startIcon={<EditIcon />} component={Link} to={`/cms/hermanos/${brother.id}/editar`}>Editar</Button>}</Paper>)}{brothers.length === 0 && <Alert severity="info">No se han encontrado hermanos.</Alert>}</Stack>}
    </>}
  </>
}
