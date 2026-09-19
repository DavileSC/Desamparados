import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Helmet } from 'react-helmet-async'
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import AgendaList from '../home/AgendaList'
import { PAPEL } from '../home/estilos'
import temaPublico from '../../theme'
import { ANCHO_EDICION } from './PantallaEdicion'
import PuntoTipo from './agenda/PuntoTipo'
import { TIPOS_EVENTO } from './agenda/tiposEvento'
import { haceCuanto } from './redaccion/completitud'
import { useVolverAlListado } from '../../hooks/useVolverAlListado'
import { createEvent, getEvent, updateEvent, type ApiEvent, type EventPayload } from '../../lib/api/events'

/** El formulario: día y hora por separado, que es como se piensa un acto. */
interface Formulario {
  title: string
  description: string
  location: string
  type: ApiEvent['type']
  visibility: ApiEvent['visibility']
  dia: string
  hora: string
  conFin: boolean
  diaFin: string
  horaFin: string
}

const vacio: Formulario = { title: '', description: '', location: '', type: 'CULTO', visibility: 'public', dia: '', hora: '', conFin: false, diaFin: '', horaFin: '' }

const dosCifras = (n: number) => String(n).padStart(2, '0')
/** Los campos de fecha y hora piden la hora local, no el ISO en UTC del servidor. */
const aDia = (fecha: Date) => `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}`
const aHora = (fecha: Date) => `${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`
const momento = (dia: string, hora: string) => (dia && hora ? new Date(`${dia}T${hora}`) : null)

function desdeEvento(evento: ApiEvent): Formulario {
  const inicio = new Date(evento.startDate)
  const fin = evento.endDate ? new Date(evento.endDate) : null
  return {
    title: evento.title, description: evento.description ?? '', location: evento.location ?? '',
    type: evento.type, visibility: evento.visibility,
    dia: aDia(inicio), hora: aHora(inicio),
    conFin: fin !== null, diaFin: fin ? aDia(fin) : '', horaFin: fin ? aHora(fin) : '',
  }
}

/**
 * La ficha de un acto de la agenda, nuevo o ya guardado, como las de Noticias y
 * Publicaciones: a la izquierda qué es (título, descripción, lugar y tipo) y
 * cómo sale en la portada; a la derecha cuándo es y quién lo ve. Antes crear
 * era una ventana y editar otra pantalla, con la fecha en un campo de fecha y
 * hora juntas y los tipos en mayúsculas («PROCESION»).
 *
 * No hay borradores: el acto se ve en la web en cuanto se guarda, y la ficha
 * lo dice. Desde el listado se puede duplicar uno: la ficha llega con
 * `copiaDe` en el state y parte de él como nuevo.
 */
export default function AgendaEditPage() {
  const { id } = useParams()
  const nuevo = id === undefined
  const { state } = useLocation()
  const copiaDe = nuevo ? (state as { copiaDe?: unknown } | null)?.copiaDe : undefined
  const navegar = useNavigate()
  // El listado del que se vino, con su página y sus filtros: el enlace de editar
  // los trae en el state. Sin state (URL tecleada) se cae en la ruta pelada.
  const volverAlListado = useVolverAlListado('/cms/agenda')
  const [guardado, setGuardado] = useState<ApiEvent | null>(null)
  const [original, setOriginal] = useState<string | null>(null)
  const [form, setForm] = useState<Formulario | null>(nuevo && typeof copiaDe !== 'number' ? vacio : null)
  const [inicial, setInicial] = useState<Formulario | null>(form)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const origen = nuevo ? copiaDe : Number(id)
    if (typeof origen !== 'number') return
    getEvent(origen)
      .then((evento) => {
        const datos = desdeEvento(evento)
        if (nuevo) setOriginal(evento.title)
        else setGuardado(evento)
        setForm(datos); setInicial(datos)
      })
      .catch(() => {
        if (nuevo) { setForm(vacio); setInicial(vacio); setError('No se ha podido cargar el evento que duplicar: empieza uno en blanco.') }
        else setError('No se ha podido cargar el evento.')
      })
  }, [id, nuevo, copiaDe])

  const sucio = JSON.stringify(form) !== JSON.stringify(inicial)
  // `guardando` fuera del bloqueo: al guardar se navega al listado con el
  // formulario aún distinto del cargado, y no hay nada que perder.
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sucio && !guardando && currentLocation.pathname !== nextLocation.pathname)

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form || !inicial) return <CircularProgress aria-label="Cargando el evento" />

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) => setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))
  const inicio = momento(form.dia, form.hora)
  const fin = form.conFin ? momento(form.diaFin || form.dia, form.horaFin) : null
  const finAntes = Boolean(inicio && fin && fin < inicio)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  // Mismo corte que el servidor: lo anterior a hoy a las 00:00 va a «Pasados».
  // Basta el día para saberlo: el aviso sale antes de poner la hora.
  const yaPaso = Boolean(form.dia && new Date(`${form.dia}T00:00`) < hoy)
  const falta = [form.title.trim() === '' && 'el título', !form.dia && 'el día', !form.hora && 'la hora', form.conFin && !form.horaFin && 'la hora del final'].filter(Boolean) as string[]
  const sePuedeGuardar = falta.length === 0 && !finAntes
  const publico = form.visibility === 'public'

  const guardar = async () => {
    if (!inicio) return
    setGuardando(true)
    setError(null)
    const payload: EventPayload = {
      title: form.title.trim(), description: form.description, location: form.location,
      type: form.type, visibility: form.visibility,
      startDate: inicio.toISOString(),
      endDate: fin ? fin.toISOString() : null,
    }
    try {
      if (nuevo) await createEvent(payload)
      else await updateEvent(Number(id), payload)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar el evento.')
      setGuardando(false)
      return
    }
    const aviso = yaPaso
      ? 'Guardado. Su fecha ya ha pasado: lo tienes en «Pasados» y no sale en la web.'
      : nuevo
        ? (publico ? 'Añadido a la agenda: ya se ve en la web.' : 'Añadido a la agenda: lo ven los hermanos al entrar con su cuenta.')
        : (publico ? 'Cambios guardados: ya se ven en la web.' : 'Cambios guardados: ya los ven los hermanos.')
    navegar(volverAlListado, { state: { aviso } })
  }

  const titulo = nuevo ? 'Nuevo evento' : (guardado?.title ?? form.title)
  const estadoTexto = nuevo
    ? (original ? `Copia de «${original}»: cambia el día y guárdalo.` : 'Sin guardar todavía: se verá en la web en cuanto lo guardes.')
    : `${inicial.visibility === 'public' ? 'En la web' : 'Solo para hermanos'}${guardado?.updatedAt ? ` · guardado ${haceCuanto(guardado.updatedAt)}` : ''}`

  return (
    <>
      <Helmet><title>{`${nuevo ? 'Nuevo evento' : 'Editar evento'} | CMS Desamparados`}</title><meta name="robots" content="noindex" /></Helmet>
      <Box sx={{ maxWidth: ANCHO_EDICION, mx: 'auto' }}>
        <Button component={Link} to={volverAlListado} startIcon={<ArrowBackIcon />} size="small" color="inherit" sx={{ mb: 1.5, color: 'text.secondary' }}>Agenda</Button>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-end', mb: 3 }}>
          <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
            <Typography variant="h2" component="h1" sx={{ fontSize: { xs: 26, md: 32 }, textWrap: 'balance', overflowWrap: 'anywhere' }}>{titulo}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{estadoTexto}</Typography>
          </Box>
          <Box>
            <Button variant="contained" disabled={guardando || !sePuedeGuardar || (!nuevo && !sucio)} onClick={() => void guardar()}>
              {nuevo ? 'Añadir a la agenda' : 'Guardar cambios'}
            </Button>
            {falta.length > 0 && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
                Para guardar hace falta {falta.length === 1 ? falta[0] : `${falta.slice(0, -1).join(', ')} y ${falta.at(-1)}`}.
              </Typography>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
          <Stack spacing={2.5}>
            <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={3}>
                <TextField
                  label="Título"
                  value={form.title}
                  onChange={(e) => campo('title', e.target.value)}
                  fullWidth
                  multiline
                  variant="standard"
                  slotProps={{ input: { sx: { fontSize: { xs: 22, md: 26 }, fontWeight: 600, lineHeight: 1.25 } } }}
                />
                <TextField
                  label="Lugar"
                  value={form.location}
                  onChange={(e) => campo('location', e.target.value)}
                  fullWidth
                  helperText="Sale junto a la hora, bajo el título: «20:00 · Parroquia de San Juan»."
                />
                <TextField
                  label="Descripción"
                  value={form.description}
                  onChange={(e) => campo('description', e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  helperText="Se lee al abrir el acto en la agenda de la portada, y bajo el título en Actualidad."
                />
                <TextField
                  select
                  label="Tipo"
                  value={form.type}
                  onChange={(e) => campo('type', e.target.value as ApiEvent['type'])}
                  helperText="Da el color en el calendario de la portada. Los cultos y las procesiones se destacan en Actualidad."
                  slotProps={{ select: { renderValue: (valor) => <PuntoTipo tipo={valor as ApiEvent['type']} /> } }}
                  sx={{ maxWidth: 360 }}
                >
                  {TIPOS_EVENTO.map((t) => <MenuItem key={t.valor} value={t.valor}><PuntoTipo tipo={t.valor} /></MenuItem>)}
                </TextField>
              </Stack>
            </Paper>

            <Panel titulo="Así sale en la portada">
              {publico ? (
                // La lista de verdad, la de la tarjeta de papel de la portada, pero sin poder pulsarla.
                <ThemeProvider theme={temaPublico}>
                  <Box inert data-testid="vista-previa-evento" sx={{ borderRadius: 1, backgroundColor: PAPEL, fontFamily: temaPublico.typography.fontFamily, pointerEvents: 'none', overflow: 'hidden' }}>
                    <AgendaList
                      hoy={hoy}
                      abiertoId="vista-previa"
                      onAlternar={() => {}}
                      eventos={[{
                        id: 'vista-previa',
                        title: form.title.trim() || 'Título del acto',
                        description: form.description,
                        location: form.location.trim() || undefined,
                        type: form.type,
                        start: inicio ?? new Date(),
                        end: fin,
                      }]}
                    />
                  </Box>
                </ThemeProvider>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No sale en la portada ni en la agenda pública: es solo para hermanos. Lo ven al entrar con su cuenta.
                </Typography>
              )}
            </Panel>
          </Stack>

          <Stack spacing={2.5}>
            <Panel titulo="Cuándo">
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5}>
                  <TextField label="Día" type="date" size="small" value={form.dia} onChange={(e) => campo('dia', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 3 }} />
                  <TextField label="Hora" type="time" size="small" value={form.hora} onChange={(e) => campo('hora', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 2 }} />
                </Stack>
                {yaPaso && <Alert severity="warning" sx={{ py: 0 }}>Ese día ya ha pasado: el acto no saldrá en la web.</Alert>}
                <FormControlLabel
                  control={<Checkbox size="small" checked={form.conFin} onChange={(e) => setForm({ ...form, conFin: e.target.checked, diaFin: form.diaFin || form.dia })} />}
                  label="Tiene hora de final"
                />
                {form.conFin && (
                  <Stack direction="row" spacing={1.5}>
                    <TextField label="Termina el día" type="date" size="small" value={form.diaFin} onChange={(e) => campo('diaFin', e.target.value)} helperText="Otro día si dura varios, como un triduo." slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 3 }} />
                    <TextField label="A las" type="time" size="small" value={form.horaFin} onChange={(e) => campo('horaFin', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 2 }} />
                  </Stack>
                )}
                {finAntes && <Alert severity="error" sx={{ py: 0 }}>El final es anterior al comienzo.</Alert>}
              </Stack>
            </Panel>

            <Panel titulo="Quién lo ve">
              <RadioGroup value={form.visibility} onChange={(e) => campo('visibility', e.target.value as ApiEvent['visibility'])}>
                <FormControlLabel value="public" control={<Radio size="small" />} label={<Opcion titulo="Público" texto="En la portada y en la agenda de la web, para todos." />} sx={{ alignItems: 'flex-start', mb: 1 }} />
                <FormControlLabel value="members_only" control={<Radio size="small" />} label={<Opcion titulo="Solo hermanos" texto="Cabildos, ensayos, convivencias: solo quien entra con su cuenta." />} sx={{ alignItems: 'flex-start' }} />
              </RadioGroup>
            </Panel>
          </Stack>
        </Box>
      </Box>

      <DialogoConfirmacion
        abierto={bloqueo.state === 'blocked'}
        titulo="Hay cambios sin guardar"
        mensaje="Si sales ahora se van a perder los cambios que has hecho en este evento."
        textoConfirmar="Salir sin guardar"
        textoCancelar="Seguir editando"
        peligro
        onConfirmar={() => bloqueo.proceed?.()}
        onCancelar={() => bloqueo.reset?.()}
      />
      <Box sx={{ height: 24 }} />
    </>
  )
}

function Opcion({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Box sx={{ pt: 0.75 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{titulo}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{texto}</Typography>
    </Box>
  )
}

function Panel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Paper component="section" sx={{ p: 2.25 }}>
      <Typography component="h2" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>{titulo}</Typography>
      {children}
    </Paper>
  )
}
