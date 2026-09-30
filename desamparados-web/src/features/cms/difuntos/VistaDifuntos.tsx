import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  NOMBRE_SUFRAGIO, aniversarios, borrarSufragio, crearSufragio, difuntos, enviarPesame, fichaDifunto, fijarDefuncion,
  type Aniversario, type FichaDifunto, type TipoSufragio,
} from '../../../lib/api/difuntos'

const zona = { timeZone: 'Europe/Madrid' } as const
const diaLargo = new Intl.DateTimeFormat('es-ES', { ...zona, day: 'numeric', month: 'long', year: 'numeric' })
const diaCorto = new Intl.DateTimeFormat('es-ES', { ...zona, day: 'numeric', month: 'short' })
const conHora = new Intl.DateTimeFormat('es-ES', { ...zona, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
/** Un día AAAA-MM-DD a mediodía: así ninguna zona horaria lo cambia de día al escribirlo. */
const deDia = (dia: string) => new Date(`${dia}T12:00:00Z`)
const aDia = (iso: string) => new Intl.DateTimeFormat('en-CA', zona).format(new Date(iso))

const CLAVE = ['difuntos'] as const
const cuandoFalta = (a: Aniversario) => (a.faltan === 0 ? 'hoy' : a.faltan === 1 ? 'mañana' : `en ${a.faltan} días`)
const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)

/**
 * Los hermanos difuntos: los aniversarios que se acercan, el registro
 * histórico y, de cada uno, su ficha con los sufragios que se le ofrecen y
 * el pésame a la familia. Difunto es quien se dio de baja por fallecimiento.
 */
export default function VistaDifuntos({ puedeGestionar }: { puedeGestionar: boolean }) {
  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState<number | null>(null)
  const lista = useQuery({ queryKey: [...CLAVE, 'lista', q], queryFn: () => difuntos(q) })
  const proximos = useQuery({ queryKey: [...CLAVE, 'aniversarios'], queryFn: aniversarios })

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(300px, 400px) minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
      <Stack spacing={2} sx={{ display: { xs: elegido ? 'none' : 'flex', md: 'flex' }, minWidth: 0 }}>
        <Paper component="section" aria-label="Próximos aniversarios" sx={{ p: 2 }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mb: 1 }}>Próximos aniversarios</Typography>
          {proximos.data?.length === 0 && <Typography variant="body2" color="text.secondary">Ninguno en los próximos dos meses.</Typography>}
          <Stack spacing={0.75}>
            {proximos.data?.slice(0, 8).map((d) => (
              <Box key={d.id} component="button" type="button" onClick={() => setElegido(d.id)} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 1, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.nombre} {d.apellidos}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {diaCorto.format(deDia(d.aniversario.dia))} · {d.aniversario.anios} {d.aniversario.anios === 1 ? 'año' : 'años'} · {cuandoFalta(d.aniversario)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
        <TextField size="small" label="Buscar entre los difuntos" value={q} onChange={(e) => setQ(e.target.value)} />
        {lista.isPending && <CircularProgress aria-label="Cargando los difuntos" />}
        {lista.data?.length === 0 && <Alert severity="info">No hay ningún hermano difunto{q ? ' con esa búsqueda' : ''}.</Alert>}
        {lista.data && lista.data.length > 0 && (
          <Paper>
            <List aria-label="Hermanos difuntos" dense>
              {lista.data.map((d) => (
                <ListItemButton key={d.id} selected={d.id === elegido} onClick={() => setElegido(d.id)}>
                  <ListItemText
                    primary={`${d.nombre} ${d.apellidos}`}
                    secondary={`Falleció el ${diaLargo.format(new Date(d.fechaDefuncion))} · ${d.aniosDeHermano} años de hermano`}
                  />
                  {d.sufragios > 0 && <Chip size="small" label={`${d.sufragios} sufragio${d.sufragios === 1 ? '' : 's'}`} />}
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Stack>
      <Box sx={{ display: { xs: elegido ? 'block' : 'none', md: 'block' }, minWidth: 0 }}>
        {elegido
          ? <Ficha key={elegido} id={elegido} puedeGestionar={puedeGestionar} onVolver={() => setElegido(null)} />
          : <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}><Typography>Elige a un hermano difunto para ver su ficha y sus sufragios.</Typography></Paper>}
      </Box>
    </Box>
  )
}

function Ficha({ id, puedeGestionar, onVolver }: { id: number; puedeGestionar: boolean; onVolver: () => void }) {
  const queryClient = useQueryClient()
  const { data: ficha, isPending, isError } = useQuery({ queryKey: [...CLAVE, 'ficha', id], queryFn: () => fichaDifunto(id) })
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null)
  const [editandoDia, setEditandoDia] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [pesame, setPesame] = useState<string | null>(null)
  const refrescar = () => queryClient.invalidateQueries({ queryKey: CLAVE })

  const guardarDia = useMutation({
    mutationFn: (fecha: string) => fijarDefuncion(id, fecha),
    onSuccess: () => { setEditandoDia(null); void refrescar() },
    onError: (e) => setAviso({ tono: 'error', texto: mensaje(e, 'No se ha podido guardar el día.') }),
  })
  const quitar = useMutation({
    mutationFn: (sufragioId: number) => borrarSufragio(sufragioId),
    onSuccess: () => { setAviso({ tono: 'success', texto: 'Sufragio quitado (y su acto de la Agenda, si lo tenía).' }); void refrescar() },
    onError: (e) => setAviso({ tono: 'error', texto: mensaje(e, 'No se ha podido quitar.') }),
  })
  const mandarPesame = useMutation({
    mutationFn: (email: string) => enviarPesame(id, email),
    onSuccess: (_r, email) => { setPesame(null); setAviso({ tono: 'success', texto: `Pésame enviado a ${email}.` }) },
    onError: (e) => setAviso({ tono: 'error', texto: mensaje(e, 'No se ha podido enviar.') }),
  })

  if (isPending) return <CircularProgress aria-label="Cargando la ficha" />
  if (isError || !ficha) return <Alert severity="error">No se ha podido cargar la ficha.</Alert>

  return (
    <Paper component="article" aria-label={`Ficha de ${ficha.nombre} ${ficha.apellidos}`} sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Button size="small" onClick={onVolver} sx={{ display: { md: 'none' }, mb: 1 }}>Volver a la lista</Button>
          <Typography variant="h5" component="h2">{ficha.nombre} {ficha.apellidos}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {editandoDia === null ? (
              <>
                <Typography color="text.secondary">
                  Hermano desde {new Date(ficha.fechaAlta).toLocaleDateString('es-ES', zona)} · falleció el {diaLargo.format(new Date(ficha.fechaDefuncion))} · {ficha.aniosDeHermano} años de hermano
                </Typography>
                {puedeGestionar && (
                  <Tooltip title="Corregir el día del fallecimiento">
                    <IconButton size="small" aria-label="Corregir el día del fallecimiento" onClick={() => setEditandoDia(aDia(ficha.fechaDefuncion))}><EditOutlinedIcon fontSize="small" /></IconButton>
                  </Tooltip>
                )}
              </>
            ) : (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                <TextField size="small" type="date" label="Día del fallecimiento" value={editandoDia} onChange={(e) => setEditandoDia(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <Button size="small" variant="contained" disabled={!editandoDia || guardarDia.isPending} onClick={() => guardarDia.mutate(editandoDia)}>Guardar</Button>
                <Button size="small" onClick={() => setEditandoDia(null)}>Cancelar</Button>
              </Stack>
            )}
          </Stack>
          <Typography sx={{ mt: 0.5 }}>
            Próximo aniversario: <strong>{diaLargo.format(deDia(ficha.aniversario.dia))}</strong> ({ficha.aniversario.anios} {ficha.aniversario.anios === 1 ? 'año' : 'años'}, {cuandoFalta(ficha.aniversario)}).
          </Typography>
        </Box>

        {aviso && <Alert severity={aviso.tono} onClose={() => setAviso(null)}>{aviso.texto}</Alert>}

        <Box>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>La familia</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {ficha.familia
              ? `Se le escribe a ${ficha.familia.nombre ?? 'la cuenta de la familia'} (${ficha.familia.email}). Se puede cambiar al enviar.`
              : 'No queda nadie de su familia con correo en el censo. Si se tiene otra dirección, se puede escribir al enviar.'}
          </Typography>
          {puedeGestionar && <Button variant="outlined" onClick={() => setPesame(ficha.familia?.email ?? '')}>Enviar el pésame</Button>}
        </Box>

        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>Sufragios</Typography>
            {puedeGestionar && <Button variant="contained" onClick={() => setNuevo(true)}>Nuevo sufragio</Button>}
          </Stack>
          {ficha.sufragios.length === 0 && <Typography variant="body2" color="text.secondary">Todavía no hay ninguno apuntado.</Typography>}
          <Stack component="ul" spacing={1.25} sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {ficha.sufragios.map((s) => (
              <Box component="li" key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, borderTop: 1, borderColor: 'divider', pt: 1.25 }}>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{s.nombreTipo}</Typography>
                  <Typography variant="body2">{conHora.format(new Date(s.fecha))}{s.lugar ? ` · ${s.lugar}` : ''}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[s.eventoId && 'En la Agenda', s.familiaAvisada && `Familia avisada el ${new Date(s.familiaAvisada).toLocaleDateString('es-ES', zona)}`, s.notas].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                {puedeGestionar && (
                  <IconButton aria-label={`Quitar ${s.nombreTipo.toLowerCase()} del ${new Date(s.fecha).toLocaleDateString('es-ES', zona)}`} disabled={quitar.isPending} onClick={() => quitar.mutate(s.id)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>

      {nuevo && <DialogoSufragio ficha={ficha} onCerrar={() => setNuevo(false)} onHecho={(texto) => { setNuevo(false); setAviso({ tono: 'success', texto }); void refrescar() }} />}

      <Dialog open={pesame !== null} onClose={() => setPesame(null)} fullWidth maxWidth="xs">
        <DialogTitle>Enviar el pésame</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Le llegará a la familia una carta del Grupo Parroquial acompañándoles por el fallecimiento de {ficha.nombre} {ficha.apellidos}.
          </Typography>
          <TextField label="Correo de la familia" type="email" value={pesame ?? ''} onChange={(e) => setPesame(e.target.value)} fullWidth autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPesame(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!pesame?.includes('@') || mandarPesame.isPending} onClick={() => pesame && mandarPesame.mutate(pesame.trim())}>
            {mandarPesame.isPending ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

/** El formulario de un sufragio nuevo: de partida, la misa de su próximo aniversario a las 19:30. */
function DialogoSufragio({ ficha, onCerrar, onHecho }: { ficha: FichaDifunto; onCerrar: () => void; onHecho: (texto: string) => void }) {
  const [tipo, setTipo] = useState<TipoSufragio>('MISA_ANIVERSARIO')
  const [fecha, setFecha] = useState(`${ficha.aniversario.dia}T19:30`)
  const [lugar, setLugar] = useState('')
  const [notas, setNotas] = useState('')
  const [enAgenda, setEnAgenda] = useState(true)
  const [avisar, setAvisar] = useState(Boolean(ficha.familia))
  const [email, setEmail] = useState(ficha.familia?.email ?? '')
  const guardar = useMutation({
    mutationFn: () => crearSufragio(ficha.id, { tipo, fecha, lugar: lugar.trim() || null, notas: notas.trim() || null, enAgenda, avisarA: avisar ? email.trim() : null }),
    onSuccess: (r) => onHecho([
      `${NOMBRE_SUFRAGIO[tipo]} apuntada.`,
      r.eventoId ? 'Ya está en la Agenda.' : '',
      avisar ? (r.familiaAvisada ? 'Familia avisada.' : 'No se pudo avisar a la familia: inténtalo más tarde.') : '',
    ].filter(Boolean).join(' ')),
  })

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Nuevo sufragio por {ficha.nombre} {ficha.apellidos}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Qué" value={tipo} onChange={(e) => setTipo(e.target.value as TipoSufragio)}>
            {(Object.entries(NOMBRE_SUFRAGIO) as [TipoSufragio, string][]).map(([valor, texto]) => <MenuItem key={valor} value={valor}>{texto}</MenuItem>)}
          </TextField>
          <TextField label="Día y hora" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Parroquia de…" slotProps={{ htmlInput: { maxLength: 200 } }} />
          <TextField label="Notas (solo para la junta)" value={notas} onChange={(e) => setNotas(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <FormControlLabel control={<Checkbox checked={enAgenda} onChange={(e) => setEnAgenda(e.target.checked)} />} label="Publicarlo en la Agenda de la web" />
          <FormControlLabel control={<Checkbox checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />} label="Avisar a la familia por correo" />
          {avisar && <TextField label="Correo de la familia" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          {guardar.isError && <Alert severity="error">{mensaje(guardar.error, 'No se ha podido guardar.')}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" disabled={!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha) || (avisar && !email.includes('@')) || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
