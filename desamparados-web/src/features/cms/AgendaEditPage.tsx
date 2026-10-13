import { type ReactNode } from 'react'
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Helmet } from 'react-helmet-async'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import ListaDeAgenda from '../inicio/ListaDeAgenda'
import VentanaDelActo from '../actualidad/agenda/VentanaDelActo'
import CampoImagen from './CampoImagen'
import { PAPEL } from '../inicio/estilos'
import temaPublico from '../../theme'
import { diaEnMadrid, horaEnMadrid, instanteEnMadrid } from '../../lib/horaDeMadrid'
import { ANCHO_EDICION } from './PantallaEdicion'
import AvisoCambiosSinGuardar from './ficha/AvisoCambiosSinGuardar'
import { useFichaCms } from './ficha/useFichaCms'
import PuntoTipo from './agenda/PuntoTipo'
import { TIPOS_EVENTO } from './agenda/tiposEvento'
import { haceCuanto } from './redaccion/completitud'
import { crearEvento, traerEvento, actualizarEvento, invalidarAgendaPublica, type ApiEvent, type DatosDeActo } from '../../lib/api/agenda'
import { site } from '../../config/site'

/** El formulario: día y hora por separado, que es como se piensa un acto. */
interface Formulario {
  title: string
  description: string
  location: string
  type: ApiEvent['type']
  dia: string
  hora: string
  conFin: boolean
  diaFin: string
  horaFin: string
  /** En la Agenda pública, como un cartel con foto y dedicatoria. */
  cartel: boolean
  dedicatoria: string
  fotoCartel: string
}

const vacio: Formulario = { title: '', description: '', location: '', type: 'CULTO', dia: '', hora: '', conFin: false, diaFin: '', horaFin: '', cartel: false, dedicatoria: '', fotoCartel: '' }

// El día y la hora se escriben y se leen en hora de Madrid, que es la del acto,
// aunque este equipo esté en otra zona: tomados en la del navegador, un acto
// puesto desde Canarias quedaba una hora más tarde en la Agenda.
const momento = (dia: string, hora: string) => {
  const instante = dia && hora ? instanteEnMadrid(`${dia}T${hora}`) : null
  return instante === null ? null : new Date(instante)
}

function desdeEvento(evento: ApiEvent): Formulario {
  const inicio = new Date(evento.startDate)
  const fin = evento.endDate ? new Date(evento.endDate) : null
  return {
    title: evento.title, description: evento.description ?? '', location: evento.location ?? '',
    type: evento.type,
    dia: diaEnMadrid(inicio), hora: horaEnMadrid(inicio),
    conFin: fin !== null, diaFin: fin ? diaEnMadrid(fin) : '', horaFin: fin ? horaEnMadrid(fin) : '',
    cartel: evento.cartel ?? false, dedicatoria: evento.dedicatoria ?? '', fotoCartel: evento.fotoCartel ?? '',
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
  const queryClient = useQueryClient()
  const nuevo = id === undefined
  const { state } = useLocation()
  const copiaDe = nuevo ? (state as { copiaDe?: unknown } | null)?.copiaDe : undefined
  // Desde el panel del día del calendario, el acto nuevo nace con ese día puesto.
  const fecha = nuevo ? (state as { fecha?: unknown } | null)?.fecha : undefined
  const diaInicial = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : ''
  // El acto que da la fecha a una salida: su día, su título y su tipo se
  // cambian desde la ficha de la salida (el servidor responde 409 aquí). Lo
  // dice el listado al abrirla; entrando por la dirección no se sabe, y el
  // 409 sale arriba con su explicación.
  const enlazada = nuevo ? null : (state as { salidaEnlazada?: { id: number; nombre: string } | null } | null)?.salidaEnlazada ?? null
  const { cargado, form, inicial, sucio, guardando, error, bloqueo, borrador, volverAlListado, campo, setForm, guardar: guardarFicha } =
    useFichaCms<ApiEvent, Formulario>({
      listado: '/cms/agenda',
      origen: nuevo ? (typeof copiaDe === 'number' ? copiaDe : null) : Number(id),
      cargar: traerEvento,
      aFormulario: desdeEvento,
      vacio: diaInicial ? { ...vacio, dia: diaInicial } : vacio,
      errorAlCargar: nuevo
        ? 'No se ha podido cargar el evento que duplicar: empieza uno en blanco.'
        : 'No se ha podido cargar el evento.',
      comoCopia: nuevo,
    })
  // Al duplicar, lo cargado no es esta ficha sino el acto del que sale: da el
  // punto de partida y su título para decirlo, pero la ficha nace sin guardar.
  const guardado = nuevo ? null : cargado
  const original = nuevo ? cargado?.title ?? null : null

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form || !inicial) return <CircularProgress aria-label="Cargando el evento" />

  const inicio = momento(form.dia, form.hora)
  const fin = form.conFin ? momento(form.diaFin || form.dia, form.horaFin) : null
  const finAntes = Boolean(inicio && fin && fin < inicio)
  // La vista previa, con el día aunque falte la hora, y sin inventarse una:
  // antes enseñaba la hora de ahora (y el día de hoy si faltaba el día).
  const hoy = new Date(new Date().setHours(0, 0, 0, 0))
  const inicioPrevia = inicio ?? momento(form.dia, '00:00') ?? hoy
  // Mismo corte que el servidor: lo anterior a hoy a las 00:00 va a «Pasados».
  // Basta el día para saberlo: el aviso sale antes de poner la hora.
  const yaPaso = Boolean(form.dia && form.dia < diaEnMadrid(new Date()))
  const falta = [form.title.trim() === '' && 'el título', !form.dia && 'el día', !form.hora && 'la hora', form.conFin && !form.horaFin && 'la hora del final'].filter(Boolean) as string[]
  const sePuedeGuardar = falta.length === 0 && !finAntes

  const guardar = async () => {
    if (!inicio) return
    const datos: DatosDeActo = {
      title: form.title.trim(), description: form.description, location: form.location,
      type: form.type,
      startDate: inicio.toISOString(),
      endDate: fin ? fin.toISOString() : null,
      cartel: form.cartel,
      dedicatoria: form.cartel ? form.dedicatoria.trim() || null : null,
      // Al quitar el cartel la foto se queda guardada: si vuelve a encenderse, ahí sigue.
      fotoCartel: form.fotoCartel || null,
    }
    await guardarFicha(
      async () => {
        await (nuevo ? crearEvento(datos) : actualizarEvento(Number(id), datos))
        // La agenda de la portada lo tenía cacheado: sin esto seguía sin él.
        invalidarAgendaPublica(queryClient)
      },
      {
        siFalla: 'No se ha podido guardar el evento.',
        aviso: yaPaso
          ? 'Guardado. Su fecha ya ha pasado: lo tienes en «Pasados» y no sale en la web.'
          : nuevo
            ? 'Añadido a la agenda: ya se ve en la web.'
            : 'Cambios guardados: ya se ven en la web.',
      },
    )
  }

  const titulo = nuevo ? 'Nuevo evento' : (guardado?.title ?? form.title)
  const estadoTexto = nuevo
    ? (original ? `Copia de «${original}»: cambia el día y guárdalo.` : 'Sin guardar todavía: se verá en la web en cuanto lo guardes.')
    : `En la web${guardado?.updatedAt ? ` · guardado ${haceCuanto(guardado.updatedAt)}` : ''}`

  return (
    <>
      <Helmet><title>{`${nuevo ? 'Nuevo evento' : 'Editar evento'} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
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
        {enlazada && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Es la fecha de la salida «{enlazada.nombre}»: su día, su hora, su título y su tipo se cambian desde{' '}
            <Link to={`/cms/procesion/salidas/${enlazada.id}/editar`}>la ficha de la salida</Link>. Aquí puedes cambiar el
            lugar, la descripción y el cartel.
          </Alert>
        )}

        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
          <Stack spacing={2.5}>
            <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={3}>
                <TextField
                  label="Título"
                  value={form.title}
                  onChange={(e) => campo('title', e.target.value)}
                  disabled={!!enlazada}
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
                  disabled={!!enlazada}
                  helperText="Da el color en el calendario de la portada. Los cultos y las procesiones se destacan en Actualidad."
                  slotProps={{ select: { renderValue: (valor) => <PuntoTipo tipo={valor as ApiEvent['type']} /> } }}
                  sx={{ maxWidth: 360 }}
                >
                  {TIPOS_EVENTO.map((t) => <MenuItem key={t.valor} value={t.valor}><PuntoTipo tipo={t.valor} /></MenuItem>)}
                </TextField>
              </Stack>
            </Paper>

            <Panel titulo="Así sale en la portada">
              {/* La lista de verdad, la de la tarjeta de papel de la portada, pero sin poder pulsarla. */}
              <ThemeProvider theme={temaPublico}>
                <Box inert data-testid="vista-previa-evento" sx={{ borderRadius: 1, backgroundColor: PAPEL, fontFamily: temaPublico.typography.fontFamily, pointerEvents: 'none', overflow: 'hidden' }}>
                  <ListaDeAgenda
                    hoy={hoy}
                    abiertoId="vista-previa"
                    onAlternar={() => {}}
                    eventos={[{
                      id: 'vista-previa',
                      title: form.title.trim() || 'Título del acto',
                      description: form.description,
                      location: form.location.trim() || undefined,
                      type: form.type,
                      start: inicioPrevia,
                      end: fin,
                      sinHora: !inicio,
                    }]}
                  />
                </Box>
              </ThemeProvider>
            </Panel>
          </Stack>

          <Stack spacing={2.5}>
            <Panel titulo="Cuándo">
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5}>
                  <TextField label="Día" type="date" size="small" disabled={!!enlazada} value={form.dia} onChange={(e) => campo('dia', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 3 }} />
                  <TextField label="Hora" type="time" size="small" disabled={!!enlazada} value={form.hora} onChange={(e) => campo('hora', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 2 }} />
                </Stack>
                {yaPaso && <Alert severity="warning" sx={{ py: 0 }}>Ese día ya ha pasado: el acto no saldrá en la web.</Alert>}
                <FormControlLabel
                  control={<Checkbox size="small" disabled={!!enlazada} checked={form.conFin} onChange={(e) => setForm({ ...form, conFin: e.target.checked, diaFin: form.diaFin || form.dia })} />}
                  label="Tiene hora de final"
                />
                {form.conFin && (
                  <Stack direction="row" spacing={1.5}>
                    <TextField label="Termina el día" type="date" size="small" disabled={!!enlazada} value={form.diaFin} onChange={(e) => campo('diaFin', e.target.value)} helperText="Otro día si dura varios, como un triduo." slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 3 }} />
                    <TextField label="A las" type="time" size="small" disabled={!!enlazada} value={form.horaFin} onChange={(e) => campo('horaFin', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 2 }} />
                  </Stack>
                )}
                {finAntes && <Alert severity="error" sx={{ py: 0 }}>El final es anterior al comienzo.</Alert>}
              </Stack>
            </Panel>

            <Panel titulo="En la Agenda pública">
              <Stack spacing={1.5}>
                <FormControlLabel
                  control={<Switch checked={form.cartel} onChange={(e) => campo('cartel', e.target.checked)} />}
                  label="Sale en cartel"
                />
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: '-4px !important' }}>
                  Para los cultos solemnes y las salidas: triduo, besamanos, función, Rosario… Con foto, grande y aparte de la lista.
                </Typography>
                {form.cartel && <>
                  <TextField
                    label="Dedicatoria"
                    size="small"
                    value={form.dedicatoria}
                    onChange={(e) => campo('dedicatoria', e.target.value)}
                    placeholder={`en honor de ${site.titular}`}
                    helperText="Va debajo del título, en cursiva. Mejor un título corto («Solemne triduo») y lo demás aquí."
                    slotProps={{ htmlInput: { maxLength: 191 } }}
                  />
                  <CampoImagen
                    valor={form.fotoCartel}
                    onCambio={(ruta) => campo('fotoCartel', ruta)}
                    etiqueta="Foto del cartel"
                    ayuda={`Sin foto, sale la ${form.type === 'PROCESION' ? 'de la procesión' : 'de la Titular'}. JPG, PNG o WebP de hasta 5 MB. Al quitarla o cambiarla y guardar, la anterior se borra del servidor.`}
                    apilada
                  />
                </>}
              </Stack>
            </Panel>
          </Stack>
        </Box>

        {form.cartel && (
          <Box sx={{ mt: 2.5 }}>
            <Panel titulo="Así sale en la Agenda">
              {/* La ventana de verdad que abre el acto en la Agenda, con el tema
                  de la web, sin poder pulsarla (inert: tampoco se enfoca su «Cerrar»). */}
              <ThemeProvider theme={temaPublico}>
                <Box inert data-testid="vista-previa-cartel" sx={{ fontFamily: temaPublico.typography.fontFamily, pointerEvents: 'none', backgroundColor: PAPEL, p: { xs: 1.5, md: 3 }, display: 'flex', justifyContent: 'center' }}>
                  <VentanaDelActo origen={null} quieto esDialogo={false} onCerrar={() => {}} sinHora={!inicio} evento={{
                    id: 0,
                    title: form.title.trim() || 'Título del acto',
                    description: form.description || null,
                    location: form.location.trim() || null,
                    startDate: inicioPrevia.toISOString(),
                    endDate: fin ? fin.toISOString() : null,
                    type: form.type,
                    cartel: true,
                    dedicatoria: form.dedicatoria.trim() || null,
                    fotoCartel: form.fotoCartel || null,
                  }} />
                </Box>
              </ThemeProvider>
            </Panel>
          </Box>
        )}
      </Box>

      <AvisoCambiosSinGuardar bloqueo={bloqueo} deQue="este evento" borrador={borrador} />
      <Box sx={{ height: 24 }} />
    </>
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
