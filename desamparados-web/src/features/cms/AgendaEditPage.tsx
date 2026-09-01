import { useEffect, useState } from 'react'
import { Alert, CircularProgress, MenuItem, Select, Stack, TextField } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import { useVolverAlListado } from '../../hooks/useVolverAlListado'
import { getEvent, updateEvent, type ApiEvent, type EventPayload } from '../../lib/api/events'

const tiposEvento: ApiEvent['type'][] = ['CULTO', 'PROCESION', 'FORMACION', 'ENSAYO', 'REUNION', 'SOCIAL', 'OTRO']

/** Los campos `datetime-local` piden la hora local, no el ISO en UTC del servidor. */
function aLocal(valor: string) {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  const desfase = fecha.getTimezoneOffset() * 60000
  return new Date(fecha.getTime() - desfase).toISOString().slice(0, 16)
}

export default function AgendaEditPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  // El listado del que se vino, con su página y sus filtros: el enlace de editar
  // los trae en el state. Sin state (URL tecleada) se cae en la ruta pelada.
  const volverAlListado = useVolverAlListado('/cms/agenda')
  const [nombre, setNombre] = useState('')
  const [form, setForm] = useState<EventPayload | null>(null)
  const [inicial, setInicial] = useState<EventPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getEvent(Number(id))
      .then((item) => {
        const datos: EventPayload = {
          title: item.title, description: item.description ?? '', startDate: aLocal(item.startDate),
          endDate: item.endDate ? aLocal(item.endDate) : null, location: item.location ?? '',
          visibility: item.visibility, type: item.type,
        }
        setNombre(item.title); setForm(datos); setInicial(datos)
      })
      .catch(() => setError('No se ha podido cargar el evento.'))
  }, [id])

  const campo = (clave: keyof EventPayload, valor: string) => setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))

  const guardar = async () => {
    if (!form) return
    setGuardando(true)
    try {
      await updateEvent(Number(id), {
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      })
      navegar(volverAlListado)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar el evento.')
      setGuardando(false)
    }
  }

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form) return <CircularProgress aria-label="Cargando el evento" />

  return (
    <>
      <Helmet><title>Editar evento | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo="Editar evento"
        nombre={nombre}
        sucio={JSON.stringify(form) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA={volverAlListado}
        onGuardar={guardar}
      >
        <Stack spacing={2}>
          <TextField label="Título" value={form.title} onChange={(e) => campo('title', e.target.value)} fullWidth />
          <TextField label="Descripción" value={form.description} onChange={(e) => campo('description', e.target.value)} fullWidth multiline />
          <TextField label="Inicio" type="datetime-local" value={form.startDate} onChange={(e) => campo('startDate', e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Fin (opcional)" type="datetime-local" value={form.endDate ?? ''} onChange={(e) => campo('endDate', e.target.value || '')} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Ubicación" value={form.location} onChange={(e) => campo('location', e.target.value)} fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Select value={form.type} onChange={(e) => campo('type', e.target.value)} aria-label="Tipo de evento" fullWidth>
              {tiposEvento.map((tipo) => <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>)}
            </Select>
            <Select value={form.visibility} onChange={(e) => campo('visibility', e.target.value)} aria-label="Visibilidad" fullWidth>
              <MenuItem value="public">Público</MenuItem>
              <MenuItem value="members_only">Solo hermanos</MenuItem>
            </Select>
          </Stack>
        </Stack>
      </PantallaEdicion>
    </>
  )
}
