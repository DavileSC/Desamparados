import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Link } from 'react-router-dom'
import { createEvent, deleteEvent, getAdminEvents, type ApiEvent, type EventPayload } from '../../lib/api/events'

const emptyForm: EventPayload = { title: '', description: '', startDate: '', endDate: null, location: '', visibility: 'public', type: 'OTRO' }
const eventTypes: ApiEvent['type'][] = ['CULTO', 'PROCESION', 'FORMACION', 'ENSAYO', 'REUNION', 'SOCIAL', 'OTRO']

export default function AgendaAdminPage() {
  const [items, setItems] = useState<ApiEvent[]>([])
  const [form, setForm] = useState<EventPayload>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = () => getAdminEvents().then(setItems)

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se ha podido cargar la agenda.')).finally(() => setLoading(false))
  }, [])

  const updateField = (field: keyof EventPayload, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const reset = () => setForm(emptyForm)

  const save = async () => {
    setSaving(true); setError(null); setNotice(null)
    try {
      const payload = { ...form, startDate: new Date(form.startDate).toISOString(), endDate: form.endDate ? new Date(form.endDate).toISOString() : null }
      await createEvent(payload)
      await load(); reset(); setNotice('Evento creado correctamente.')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido guardar el evento.') }
    finally { setSaving(false) }
  }

  const remove = async (id: number) => {
    if (!window.confirm('¿Quieres eliminar este evento?')) return
    try { await deleteEvent(id); await load(); setNotice('Evento eliminado correctamente.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar el evento.') }
  }

  return <>
    <Helmet><title>Agenda | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <Typography variant="h2" component="h1" sx={{ mb: 4 }}>Agenda</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <Paper sx={{ p: { xs: 2, md: 4 }, mb: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Nuevo evento</Typography>
        <TextField label="Título" value={form.title} onChange={(event) => updateField('title', event.target.value)} fullWidth />
        <TextField label="Descripción" value={form.description} onChange={(event) => updateField('description', event.target.value)} fullWidth multiline />
        <TextField label="Inicio" type="datetime-local" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Fin (opcional)" type="datetime-local" value={form.endDate ?? ''} onChange={(event) => updateField('endDate', event.target.value || '')} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Ubicación" value={form.location} onChange={(event) => updateField('location', event.target.value)} fullWidth />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Select value={form.type} onChange={(event) => updateField('type', event.target.value)} aria-label="Tipo de evento" fullWidth>{eventTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select>
          <Select value={form.visibility} onChange={(event) => updateField('visibility', event.target.value)} aria-label="Visibilidad" fullWidth><MenuItem value="public">Público</MenuItem><MenuItem value="members_only">Solo hermanos</MenuItem></Select>
        </Stack>
        <Box><Button variant="contained" startIcon={<AddIcon />} onClick={save} disabled={saving || !form.title || !form.startDate}>{saving ? 'Guardando...' : 'Guardar'}</Button></Box>
      </Stack>
    </Paper>
    <Typography variant="h4" sx={{ mb: 2 }}>Eventos</Typography>
    {loading ? <CircularProgress aria-label="Cargando agenda" /> : <Stack spacing={2}>{items.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h6">{item.title}</Typography><Typography variant="body2" color="text.secondary">{new Date(item.startDate).toLocaleString('es-ES')} · {item.visibility === 'public' ? 'Público' : 'Solo hermanos'}</Typography></Box><Stack direction="row"><Button aria-label={`Editar ${item.title}`} component={Link} to={`/cms/agenda/${item.id}/editar`}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.title}`} onClick={() => remove(item.id)}><DeleteIcon /></Button></Stack></Paper>)}{items.length === 0 && <Alert severity="info">No hay eventos registrados.</Alert>}</Stack>}
  </>
}
