import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControlLabel, IconButton, Paper, Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, TextField, Tooltip, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../altas/auth/store'
import { rolesPorRutaCms } from '../../app/cmsNavegacion'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import {
  cambiarCuotaSalida, cambiarPlazo, crearTurno, eliminarTurno, fijarRosario, plazoDePapeletas, turnosDeReparto,
  type PlazoDePapeletas, type Salida, type TurnoDeReparto,
} from '../../lib/api/procesion'
import { useColoresContabilidad } from './contabilidad/tema'
import { cabeceraTabla, soloLector } from './inventario/tabla'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import Cortejo from './cortejo/Cortejo'
import { site } from '../../config/site'

const ZONA = 'Europe/Madrid'
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const formatoCorto = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, day: 'numeric', month: 'long' })
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)
const euros = (valor: number | null) => (valor === null ? '—' : `${valor.toFixed(2).replace('.', ',')} €`)

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)
const DIA_VACIO = { fecha: '', horaInicio: '18:00', horaFin: '21:00', aforo: '100' }
const NOMBRE: Record<Salida, string> = { PASION: 'Sábado de Pasión', ROSARIO: 'Rosario vespertino' }

/** Un instante como «AAAA-MM-DD» y «HH:MM» en hora de Madrid, para los campos del formulario. */
function partes(iso: string | null | undefined) {
  if (!iso) return { dia: '', hora: '19:00' }
  const d = new Date(iso)
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d)
  return { dia, hora: formatoHora.format(d) }
}

/**
 * Las salidas vistas desde Secretaría: la del Sábado de Pasión y el Rosario
 * vespertino, cada una con su plazo para pedir la papeleta desde el área de
 * hermanos y sus días de reparto (que salen en la Agenda pública). Del
 * Rosario, además, su fecha, que decide el Grupo cada año. De la Pasión, la
 * cuota de salida (hoy 0 €: no se cobra).
 *
 * Abrir un plazo avisa por correo a los hermanos y deja un borrador de
 * noticia con los días, para revisarlo, publicarlo y moverlo por redes.
 */
export default function ProcesionAdminPage() {
  const role = useAuthStore((state) => state.cms?.role ?? 'USER')
  // El Hermano Mayor lo ve; abrir, cerrar y crear días es cosa de Secretaría.
  const puedeCambiar = role === 'ADMIN' || role === 'SECRETARIA'
  const { fondoCabecera } = useColoresContabilidad()

  const [salida, setSalida] = useState<Salida>('PASION')
  const [plazo, setPlazo] = useState<PlazoDePapeletas | null>(null)
  // Al cambiar de salida se sigue viendo la anterior hasta que llega la nueva:
  // vaciar la pantalla mientras carga la hacía saltar dos veces.
  const vista: Salida = plazo?.salida ?? salida
  const cargando = plazo !== null && plazo.salida !== salida
  const [turnos, setTurnos] = useState<TurnoDeReparto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; noticiaId: number | null } | null>(null)

  const [abriendo, setAbriendo] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [avisar, setAvisar] = useState(true)
  const [borrador, setBorrador] = useState(true)
  const [cambiando, setCambiando] = useState(false)

  const [creando, setCreando] = useState(false)
  const [dia, setDia] = useState(DIA_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [errorDia, setErrorDia] = useState<string | null>(null)
  const [porBorrar, setPorBorrar] = useState<TurnoDeReparto | null>(null)
  // La hora con la que se marcan los días ya pasados: la de abrir la pantalla basta.
  const [ahora] = useState(() => Date.now())

  const cargar = useCallback((s: Salida) => Promise.all([plazoDePapeletas(s), turnosDeReparto(s)])
    .then(([p, t]) => { setPlazo(p); setTurnos(t) }), [])

  useEffect(() => {
    let cancelado = false
    Promise.all([plazoDePapeletas(salida), turnosDeReparto(salida)])
      .then(([p, t]) => { if (!cancelado) { setPlazo(p); setTurnos(t) } })
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar la procesión.')) })
    return () => { cancelado = true }
  }, [salida])

  const recargar = () => cargar(salida).catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar la procesión.')))

  const cambiar = async (abrir: boolean) => {
    setCambiando(true); setError(null); setAviso(null)
    try {
      const r = await cambiarPlazo(abrir, abrir ? { avisar, borradorNoticia: borrador, salida } : { salida })
      setAviso({
        texto: abrir
          ? `Solicitud abierta.${r.avisados ? ` Se está avisando por correo a ${r.avisados} ${r.avisados === 1 ? 'cuenta' : 'cuentas'}.` : ''}`
          : 'Solicitud cerrada. Los hermanos ya no pueden pedir papeleta desde su área.',
        noticiaId: r.noticiaId,
      })
      await recargar()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido cambiar el plazo.'))
    } finally {
      setCambiando(false); setAbriendo(false); setCerrando(false)
    }
  }

  const guardarDia = async () => {
    setGuardando(true); setErrorDia(null)
    try {
      // Las horas se escriben en hora de Madrid, que es la del navegador de quien las pone.
      await crearTurno({
        fecha: dia.fecha,
        horaInicio: new Date(`${dia.fecha}T${dia.horaInicio}`).toISOString(),
        horaFin: new Date(`${dia.fecha}T${dia.horaFin}`).toISOString(),
        capacidadEstimada: Number(dia.aforo),
        salida,
      })
      setCreando(false)
      setAviso({ texto: 'Día de reparto añadido. Ya sale en la Agenda.', noticiaId: null })
      await recargar()
    } catch (e: unknown) {
      setErrorDia(mensaje(e, 'No se ha podido guardar el día.'))
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    const turno = porBorrar
    setPorBorrar(null)
    if (!turno) return
    try {
      await eliminarTurno(turno.id)
      setAviso({ texto: 'Día de reparto borrado (y quitado de la Agenda).', noticiaId: null })
      await recargar()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido borrar el día.'))
    }
  }

  const ordenados = [...turnos].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  const aforoValido = /^\d+$/.test(dia.aforo) && Number(dia.aforo) > 0
  const sinDias = plazo !== null && plazo.diasDeReparto === 0

  return (
    <>
      <Helmet><title>{`Procesión | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Procesión" subtitulo={plazo ? `${NOMBRE[vista]} ${plazo.year}: días de reparto y solicitud de papeletas.` : undefined}>
        {rolesPorRutaCms['procesion/mesa'].includes(role) && <Button variant="outlined" component={Link} to="/cms/procesion/mesa">Abrir la mesa</Button>}
        {puedeCambiar && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDia(DIA_VACIO); setErrorDia(null); setCreando(true) }}>Nuevo día de reparto</Button>}
      </CabeceraSeccion>

      <Tabs value={salida} onChange={(_e, v: Salida) => { setSalida(v); setAviso(null); setError(null) }} aria-label="Salida" sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="PASION" label="Sábado de Pasión" />
        <Tab value="ROSARIO" label="Rosario vespertino" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {aviso && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
          {aviso.noticiaId && <> Hay un <Box component={Link} to={`/cms/noticias/${aviso.noticiaId}/editar`} sx={{ color: 'inherit', fontWeight: 600 }}>borrador de noticia</Box> listo para revisar y publicar.</>}
        </Alert>
      )}

      {!plazo && !error && <CircularProgress aria-label="Cargando la procesión" />}

      <Box aria-busy={cargando} sx={{ opacity: cargando ? 0.55 : 1, transition: cargando ? 'opacity .2s .15s' : 'none' }}>
      {plazo && vista === 'ROSARIO' && (
        <FechaDelRosario key={plazo.rosario?.eventoId ?? 'sin'} plazo={plazo} puedeCambiar={puedeCambiar} onGuardado={(t) => { setAviso({ texto: t, noticiaId: null }); void recargar() }} onError={setError} />
      )}

      {plazo && (
        <Paper component="section" aria-labelledby="plazo-titulo" sx={{ p: { xs: 2.5, md: 3 }, mb: 3, maxWidth: 900, display: 'grid', gap: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 420px' }}>
              <Typography id="plazo-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>
                {vista === 'ROSARIO' ? 'Inscripción del Rosario en el área de hermanos' : 'Solicitud de papeletas en el área de hermanos'}
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: 14.5, color: 'text.secondary', lineHeight: 1.55 }}>
                Mientras está cerrada, los hermanos no pueden pedir papeleta ni reservar día: ven que el plazo aún no está abierto. La mesa puede apuntar a mano en cualquier momento.
              </Typography>
            </Box>
            <FormControlLabel
              labelPlacement="start"
              label={<Typography sx={{ fontWeight: 600, color: plazo.abierto ? 'success.main' : 'warning.main' }}>{plazo.abierto ? 'Abierta' : 'Cerrada'}</Typography>}
              control={
                <Switch
                  checked={plazo.abierto}
                  disabled={!puedeCambiar || cambiando || cargando || (!plazo.abierto && sinDias)}
                  onChange={(_, abrir) => (abrir ? setAbriendo(true) : setCerrando(true))}
                  slotProps={{ input: { 'aria-label': 'Solicitud de papeletas abierta' } }}
                />
              }
              sx={{ m: 0, gap: 1 }}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
            <Cifra titulo="Días de reparto por delante" valor={String(plazo.diasDeReparto)}
              detalle={plazo.primerDia && plazo.ultimoDia ? (plazo.primerDia === plazo.ultimoDia ? `el ${formatoCorto.format(new Date(plazo.primerDia))}` : `del ${formatoCorto.format(new Date(plazo.primerDia))} al ${formatoCorto.format(new Date(plazo.ultimoDia))}`) : 'ninguno publicado'} />
            {vista === 'PASION'
              ? <CuotaDeSalida valor={plazo.cuotaSalida} puedeCambiar={role === 'ADMIN'} onGuardada={() => { setAviso({ texto: 'Cuota de salida guardada.', noticiaId: null }); void recargar() }} onError={setError} />
              : <Cifra titulo="Para participar" valor="La voluntad" detalle="un donativo libre, que puede ser 0 €" />}
            <Cifra titulo="Citas reservadas" valor={String(plazo.citasReservadas)} detalle={plazo.abierto ? 'en los días por delante' : 'se reservan con el plazo abierto'} />
          </Box>

          {sinDias && !plazo.abierto && (
            <Alert severity="warning">Sin días de reparto por delante no se puede abrir: los hermanos no tendrían día que elegir. Añade al menos uno.</Alert>
          )}
          {plazo.cambiadoEl && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {plazo.abierto ? 'Abierta' : 'Cerrada'} desde el {formatoCorto.format(new Date(plazo.cambiadoEl))}.
            </Typography>
          )}
        </Paper>
      )}

      {plazo && (
        <Box component="section" aria-labelledby="dias-titulo">
          <Typography id="dias-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600, mb: 0.5 }}>Días de reparto</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1.5 }}>Cada día sale en la Agenda pública, para que la gente sepa cuándo ir a apuntarse.</Typography>
          <TableContainer component={Paper}>
            <Table size="small" aria-labelledby="dias-titulo" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow sx={cabeceraTabla(fondoCabecera)}>
                  <TableCell>Día</TableCell>
                  <TableCell>Horario</TableCell>
                  <TableCell align="right">Citas</TableCell>
                  <TableCell align="right">Vinieron</TableCell>
                  {puedeCambiar && <TableCell padding="none" sx={{ width: 64 }}><Box component="span" sx={soloLector}>Acciones</Box></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {ordenados.map((t) => {
                  const pasado = new Date(t.horaFin).getTime() < ahora
                  const citas = t.citas
                  return (
                    <TableRow key={t.id} hover sx={pasado ? { '& td': { color: 'text.disabled' } } : undefined}>
                      <TableCell sx={{ fontWeight: pasado ? 400 : 600 }}>{mayuscula(formatoDia.format(new Date(t.fecha)))}{pasado ? ' · pasado' : ''}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatoHora.format(new Date(t.horaInicio))} a {formatoHora.format(new Date(t.horaFin))}</TableCell>
                      {/* El aforo solo importa mientras se puede reservar: en los pasados sobra. */}
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        <Box component="span" sx={{ fontWeight: 600 }}>{citas}</Box>
                        {!pasado && <Box component="span" sx={{ color: 'text.secondary' }}> de {t.capacidadEstimada}</Box>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{t.vinieron > 0 || pasado ? t.vinieron : '—'}</TableCell>
                      {puedeCambiar && (
                        <TableCell padding="none" align="right" sx={{ pr: 1 }}>
                          {/* Un día ya pasado es historia del reparto: no se borra. */}
                          {!pasado && <Tooltip title={citas > 0 ? 'Tiene citas: no se puede borrar' : 'Borrar el día'}>
                            <span>
                              <IconButton size="small" disabled={citas > 0} aria-label={`Borrar el día ${formatoDia.format(new Date(t.fecha))}`} onClick={() => setPorBorrar(t)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
                {ordenados.length === 0 && (
                  <TableRow><TableCell colSpan={puedeCambiar ? 5 : 4} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>Todavía no hay días de reparto.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {plazo && <Cortejo key={salida} salida={salida} puedeCambiar={puedeCambiar} onAviso={(texto) => setAviso({ texto, noticiaId: null })} />}
      </Box>

      {/* Abrir avisa a cientos de hermanos: se pregunta antes, y con qué avisar. */}
      <Dialog open={abriendo} onClose={() => !cambiando && setAbriendo(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{salida === 'ROSARIO' ? '¿Abrir la inscripción del Rosario?' : '¿Abrir la solicitud de papeletas?'}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Los hermanos podrán pedir la papeleta desde su área y elegir uno de los {plazo?.diasDeReparto ?? 0} días de reparto publicados.
          </DialogContentText>
          <Stack>
            <FormControlLabel control={<Checkbox checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />} label="Avisar por correo a los hermanos activos" />
            <FormControlLabel control={<Checkbox checked={borrador} onChange={(e) => setBorrador(e.target.checked)} />} label="Dejar un borrador de noticia con los días, para publicarlo y moverlo por redes" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbriendo(false)} disabled={cambiando}>Volver</Button>
          <Button variant="contained" onClick={() => void cambiar(true)} disabled={cambiando}>{cambiando ? 'Abriendo…' : 'Abrir la solicitud'}</Button>
        </DialogActions>
      </Dialog>

      <DialogoConfirmacion
        abierto={cerrando}
        titulo="¿Cerrar la solicitud de papeletas?"
        mensaje="Los hermanos dejarán de poder pedir papeleta y reservar día. Las citas ya reservadas se mantienen."
        textoConfirmar="Cerrar la solicitud"
        onConfirmar={() => void cambiar(false)}
        onCancelar={() => setCerrando(false)}
      />

      <DialogoConfirmacion
        abierto={porBorrar !== null}
        titulo="¿Borrar el día de reparto?"
        mensaje={porBorrar ? mayuscula(formatoDia.format(new Date(porBorrar.fecha))) : ''}
        textoConfirmar="Borrar"
        peligro
        onConfirmar={() => void borrar()}
        onCancelar={() => setPorBorrar(null)}
      />

      <VentanaFormulario
        abierto={creando}
        titulo={`Nuevo día de reparto · ${NOMBRE[salida]}`}
        sucio={dia.fecha !== ''}
        guardando={guardando}
        puedeGuardar={Boolean(dia.fecha && dia.horaInicio && dia.horaFin && aforoValido)}
        error={errorDia}
        onGuardar={guardarDia}
        onCerrar={() => setCreando(false)}
      >
        <TextField label="Día" type="date" value={dia.fecha} onChange={(e) => setDia({ ...dia, fecha: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Desde" type="time" value={dia.horaInicio} onChange={(e) => setDia({ ...dia, horaInicio: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
          <TextField label="Hasta" type="time" value={dia.horaFin} onChange={(e) => setDia({ ...dia, horaFin: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
        </Stack>
        <TextField
          label="Aforo" type="number" value={dia.aforo} onChange={(e) => setDia({ ...dia, aforo: e.target.value })}
          helperText="Cuántos hermanos se pueden atender bien ese día. Completo, deja de ofrecerse."
          error={!aforoValido} slotProps={{ htmlInput: { min: 1, step: 1, inputMode: 'numeric' } }} fullWidth
        />
      </VentanaFormulario>
    </>
  )
}

/**
 * La fecha del Rosario vespertino: la decide el Grupo cada año, siempre en
 * octubre. Al guardarla sale en la Agenda pública (es el segundo acto del año
 * tras el Sábado de Pasión) y va impresa en la papeleta.
 */
function FechaDelRosario({ plazo, puedeCambiar, onGuardado, onError }: {
  plazo: PlazoDePapeletas; puedeCambiar: boolean; onGuardado: (texto: string) => void; onError: (m: string) => void
}) {
  const inicial = partes(plazo.rosario?.inicio)
  const [fecha, setFecha] = useState(inicial.dia)
  const [hora, setHora] = useState(inicial.hora)
  const [lugar, setLugar] = useState(plazo.rosario?.lugar ?? '')
  const [guardando, setGuardando] = useState(false)
  const enOctubre = /^\d{4}-10-\d{2}$/.test(fecha)

  const guardar = async () => {
    setGuardando(true)
    try {
      await fijarRosario({ inicio: new Date(`${fecha}T${hora}`).toISOString(), lugar: lugar.trim() || null })
      onGuardado(plazo.rosario ? 'Fecha del Rosario cambiada. La Agenda ya la enseña.' : 'Fecha del Rosario guardada. Ya sale en la Agenda.')
    } catch (e) {
      onError(mensaje(e, 'No se ha podido guardar la fecha del Rosario.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Paper component="section" aria-labelledby="rosario-titulo" sx={{ p: { xs: 2.5, md: 3 }, mb: 3, maxWidth: 900, display: 'grid', gap: 2 }}>
      <Box>
        <Typography id="rosario-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>Fecha del Rosario vespertino</Typography>
        <Typography sx={{ mt: 0.75, fontSize: 14.5, color: 'text.secondary', lineHeight: 1.55 }}>
          {plazo.rosario
            ? `Sale el ${formatoDia.format(new Date(plazo.rosario.inicio))} a las ${formatoHora.format(new Date(plazo.rosario.inicio))}. Está en la Agenda pública.`
            : 'Todavía sin fecha. La decide el Grupo cada año, siempre en octubre; al guardarla sale en la Agenda pública.'}
        </Typography>
      </Box>
      {puedeCambiar && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
          <TextField size="small" label="Día" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
            error={fecha !== '' && !enOctubre} helperText={fecha !== '' && !enOctubre ? 'Tiene que ser en octubre' : ' '} />
          <TextField size="small" label="Hora de salida" type="time" value={hora} onChange={(e) => setHora(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} helperText=" " />
          <TextField size="small" label="Lugar de salida" value={lugar} onChange={(e) => setLugar(e.target.value)} sx={{ flex: 1 }} helperText=" " />
          <Button variant="contained" onClick={() => void guardar()} disabled={guardando || !enOctubre || !hora}>{plazo.rosario ? 'Cambiar' : 'Guardar'}</Button>
        </Stack>
      )}
    </Paper>
  )
}

/**
 * La cuota de salida de la Pasión. Hoy no se cobra (0 €) y el hermano no ve
 * nada de ella; queda configurable por si algún año se decide cobrarla. No
 * hay alquiler de túnica: lavarlas o arreglarlas lo paga el Grupo.
 */
function CuotaDeSalida({ valor, puedeCambiar, onGuardada, onError }: {
  valor: number | null; puedeCambiar: boolean; onGuardada: () => void; onError: (m: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor === null ? '0' : String(valor).replace('.', ','))
  const [guardando, setGuardando] = useState(false)
  const valido = /^\d{1,8}(?:[.,]\d{1,2})?$/.test(texto.trim())

  const guardar = async () => {
    setGuardando(true)
    try { await cambiarCuotaSalida(texto.trim()); setEditando(false); onGuardada() } catch (e) { onError(mensaje(e, 'No se ha podido guardar la cuota de salida.')) } finally { setGuardando(false) }
  }

  if (editando) {
    return (
      <Box sx={{ p: 1.75, borderRadius: 1, backgroundColor: 'action.hover', display: 'grid', gap: 1 }}>
        <TextField size="small" label="Cuota de salida (€)" value={texto} onChange={(e) => setTexto(e.target.value)} error={!valido} autoFocus slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => setEditando(false)} disabled={guardando}>Volver</Button>
          <Button size="small" variant="contained" onClick={() => void guardar()} disabled={guardando || !valido}>Guardar</Button>
        </Stack>
      </Box>
    )
  }
  return (
    <Box sx={{ position: 'relative' }}>
      <Cifra titulo="Cuota de salida" valor={valor === 0 ? 'No se cobra' : euros(valor)} detalle="para salir basta con la cuota de hermano al día" />
      {puedeCambiar && <Button size="small" onClick={() => setEditando(true)} sx={{ position: 'absolute', top: 6, right: 6 }}>Cambiar</Button>}
    </Box>
  )
}

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Box sx={{ p: 1.75, borderRadius: 1, backgroundColor: 'action.hover', height: '100%' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>{titulo}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
      {detalle && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{detalle}</Typography>}
    </Box>
  )
}
