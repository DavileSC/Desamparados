import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
  cambiarPlazo, crearTurno, eliminarTurno, plazoDePapeletas, turnosDeReparto, type PlazoDePapeletas, type TurnoDeReparto,
} from '../../lib/api/procesion'
import AvisoSinSalidas from '../procesion/AvisoSinSalidas'
import { useSalidaElegida } from '../procesion/useSalidas'
import { useColoresContabilidad } from './contabilidad/tema'
import { cabeceraTabla, soloLector } from './inventario/tabla'
import { Dato, DatosDeFicha, Ficha, ListaDeFichas } from './listados/Fichas'
import { useEnFichas } from './listados/useEnFichas'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import Cortejo from './cortejo/Cortejo'
import { site } from '../../config/site'
import { useModulos } from '../../hooks/useModulos'
import { deArticulo, laCorporacion, segunLaCorporacion, type Articulo } from '../../domain/articulos'
import { euros } from '../../lib/euros'

const ZONA = 'Europe/Madrid'
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const formatoCorto = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, day: 'numeric', month: 'long' })
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)
const importe = (valor: number | null) => (valor === null ? '—' : euros(valor))

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)
const DIA_VACIO = { fecha: '', horaInicio: '18:00', horaFin: '21:00', aforo: '100' }
const enlace = { color: 'inherit', fontWeight: 600 } as const

/**
 * Las salidas activas vistas desde Secretaría, una por pestaña, cada una con
 * su plazo para pedir la papeleta desde el área de hermanos y sus días de
 * reparto (que salen en la Agenda pública). La fecha de las que van a mano y
 * la cuota se cambian en Procesión → Salidas: aquí solo se enseñan.
 *
 * Abrir un plazo avisa por correo a los hermanos y deja un borrador de
 * noticia con los días, para revisarlo, publicarlo y moverlo por redes.
 */
export default function ProcesionAdminPage() {
  const role = useAuthStore((state) => state.cms?.role ?? 'USER')
  // El Hermano Mayor lo ve; abrir, cerrar y crear días es cosa de Secretaría.
  const puedeCambiar = role === 'ADMIN' || role === 'SECRETARIA'
  const { fondoCabecera } = useColoresContabilidad()

  // Recordada por slug, como en la mesa y la puerta: al volver, sigue en la misma salida.
  const { salidas, salida, elegir, cargando: cargandoSalidas, error: errorSalidas } = useSalidaElegida('procesion.salida')
  const slug = salida?.slug ?? null
  const [plazo, setPlazo] = useState<PlazoDePapeletas | null>(null)
  // Al cambiar de salida se sigue viendo la anterior hasta que llega la nueva:
  // vaciar la pantalla mientras carga la hacía saltar dos veces.
  const vista = salidas.find((s) => s.slug === plazo?.salida) ?? salida
  const cargando = plazo !== null && plazo.salida !== slug
  const [turnos, setTurnos] = useState<TurnoDeReparto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; noticiaId: number | null } | null>(null)

  const [abriendo, setAbriendo] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [avisar, setAvisar] = useState(true)
  const [borrador, setBorrador] = useState(true)
  // Sin Noticias no hay dónde dejar el borrador: ni se ofrece ni se pide.
  const conNoticias = useModulos().activo('noticias')
  const [cambiando, setCambiando] = useState(false)

  const [creando, setCreando] = useState(false)
  const [dia, setDia] = useState(DIA_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [errorDia, setErrorDia] = useState<string | null>(null)
  const [porBorrar, setPorBorrar] = useState<TurnoDeReparto | null>(null)
  const enFichas = useEnFichas()
  // La hora con la que se marcan los días ya pasados: la de abrir la pantalla basta.
  const [ahora] = useState(() => Date.now())

  const cargar = useCallback((s: string) => Promise.all([plazoDePapeletas(s), turnosDeReparto(s)])
    .then(([p, t]) => { setPlazo(p); setTurnos(t) }), [])

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    Promise.all([plazoDePapeletas(slug), turnosDeReparto(slug)])
      .then(([p, t]) => { if (!cancelado) { setPlazo(p); setTurnos(t) } })
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar la procesión.')) })
    return () => { cancelado = true }
  }, [slug])

  const recargar = () => (slug ? cargar(slug) : Promise.resolve()).catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar la procesión.')))

  const cambiar = async (abrir: boolean) => {
    if (!slug) return
    setCambiando(true); setError(null); setAviso(null)
    try {
      const r = await cambiarPlazo(abrir, slug, abrir ? { avisar, borradorNoticia: borrador && conNoticias } : {})
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
    if (!slug) return
    setGuardando(true); setErrorDia(null)
    try {
      // Las horas se escriben en hora de Madrid, que es la del navegador de quien las pone.
      await crearTurno({
        fecha: dia.fecha,
        horaInicio: new Date(`${dia.fecha}T${dia.horaInicio}`).toISOString(),
        horaFin: new Date(`${dia.fecha}T${dia.horaFin}`).toISOString(),
        capacidadEstimada: Number(dia.aforo),
        salida: slug,
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
  const borrarDia = (t: TurnoDeReparto) => (
    <Tooltip title={t.citas > 0 ? 'Tiene citas: no se puede borrar' : 'Borrar el día'}>
      <span>
        <IconButton size="small" disabled={t.citas > 0} aria-label={`Borrar el día ${formatoDia.format(new Date(t.fecha))}`} onClick={() => setPorBorrar(t)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
  const aforoValido = /^\d+$/.test(dia.aforo) && Number(dia.aforo) > 0
  const sinDias = plazo !== null && plazo.diasDeReparto === 0

  if (cargandoSalidas) return <CircularProgress aria-label="Cargando la procesión" />
  if (!salida || !vista) {
    return (
      <>
        <CabeceraSeccion titulo="Procesión" />
        <AvisoSinSalidas error={errorSalidas} />
      </>
    )
  }

  return (
    <>
      <Helmet><title>{`Procesión | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Procesión" subtitulo={plazo ? `${vista.nombre} ${plazo.year}: días de reparto y solicitud de papeletas.` : undefined}>
        {rolesPorRutaCms['procesion/mesa'].includes(role) && <Button variant="outlined" component={Link} to="/cms/procesion/mesa">Abrir la mesa</Button>}
        {puedeCambiar && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDia(DIA_VACIO); setErrorDia(null); setCreando(true) }}>Nuevo día de reparto</Button>}
      </CabeceraSeccion>

      {/* Con una sola salida no hay nada que elegir: sin pestañas. */}
      {salidas.length > 1 && (
        <Tabs value={salida.slug} onChange={(_e, v: string) => { elegir(v); setAviso(null); setError(null) }} variant="scrollable" aria-label="Salida" sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
          {salidas.map((s) => <Tab key={s.slug} value={s.slug} label={s.nombre} />)}
        </Tabs>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {aviso && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
          {aviso.noticiaId && <> Hay un <Box component={Link} to={`/cms/noticias/${aviso.noticiaId}/editar`} sx={{ color: 'inherit', fontWeight: 600 }}>borrador de noticia</Box> listo para revisar y publicar.</>}
        </Alert>
      )}

      {!plazo && !error && <CircularProgress aria-label="Cargando la procesión" />}

      <Box aria-busy={cargando} sx={{ opacity: cargando ? 0.55 : 1, transition: cargando ? 'opacity .2s .15s' : 'none' }}>
      {plazo && vista.fecha === 'MANUAL' && <FechaDeLaSalida nombre={vista.nombre} articulo={vista.articulo} fecha={plazo.fecha ?? null} />}

      {plazo && (
        <Paper component="section" aria-labelledby="plazo-titulo" sx={{ p: { xs: 2.5, md: 3 }, mb: 3, maxWidth: 900, display: 'grid', gap: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 420px' }}>
              <Typography id="plazo-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>
                Solicitud de papeletas {deArticulo(vista.articulo, vista.nombre)} en el área de hermanos
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
            {vista.cobro === 'CUOTA'
              ? <Cifra titulo="Cuota de salida" valor={plazo.cuotaSalida === 0 ? 'No se cobra' : importe(plazo.cuotaSalida)}
                  detalle={<>se cambia en <Box component={Link} to="/cms/procesion/salidas" sx={enlace}>Procesión → Salidas</Box></>} />
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
          {enFichas ? (
            <ListaDeFichas etiqueta="Días de reparto" vacia={ordenados.length === 0 ? 'Todavía no hay días de reparto.' : undefined}>
              {ordenados.map((t) => {
                const pasado = new Date(t.horaFin).getTime() < ahora
                return (
                  <Ficha
                    key={t.id}
                    acciones={puedeCambiar && !pasado ? borrarDia(t) : undefined}
                    titulo={
                      <Typography sx={{ fontWeight: pasado ? 400 : 600, color: pasado ? 'text.disabled' : 'text.primary' }}>
                        {mayuscula(formatoDia.format(new Date(t.fecha)))}{pasado ? ' · pasado' : ''}
                      </Typography>
                    }
                  >
                    <DatosDeFicha>
                      <Dato etiqueta="Horario">{formatoHora.format(new Date(t.horaInicio))} a {formatoHora.format(new Date(t.horaFin))}</Dato>
                      <Dato etiqueta="Citas">{t.citas}{!pasado && ` de ${t.capacidadEstimada}`}</Dato>
                      <Dato etiqueta="Vinieron">{t.vinieron > 0 || pasado ? t.vinieron : '—'}</Dato>
                    </DatosDeFicha>
                  </Ficha>
                )
              })}
            </ListaDeFichas>
          ) : (
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
                          {!pasado && borrarDia(t)}
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
          )}
        </Box>
      )}

      {plazo && <Cortejo key={vista.slug} salida={vista.slug} puestos={vista.puestos.map((p) => p.nombre)} puedeCambiar={puedeCambiar} onAviso={(texto) => setAviso({ texto, noticiaId: null })} />}
      </Box>

      {/* Abrir avisa a cientos de hermanos: se pregunta antes, y con qué avisar. */}
      <Dialog open={abriendo} onClose={() => !cambiando && setAbriendo(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{`¿Abrir la solicitud de papeletas ${deArticulo(salida.articulo, salida.nombre)}?`}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Los hermanos podrán pedir la papeleta desde su área y elegir uno de los {plazo?.diasDeReparto ?? 0} días de reparto publicados.
          </DialogContentText>
          <Stack>
            <FormControlLabel control={<Checkbox checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />} label="Avisar por correo a los hermanos activos" />
            {conNoticias && <FormControlLabel control={<Checkbox checked={borrador} onChange={(e) => setBorrador(e.target.checked)} />} label="Dejar un borrador de noticia con los días, para publicarlo y moverlo por redes" />}
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
        titulo={`Nuevo día de reparto · ${salida.nombre}`}
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
 * La fecha de una salida que no cae por la Pascua: la decide el Grupo cada
 * año. Se fija en Procesión → Salidas, que la pone en la Agenda pública; aquí
 * solo se enseña, porque sin ella no se puede abrir la solicitud.
 */
function FechaDeLaSalida({ nombre, articulo, fecha }: { nombre: string; articulo: Articulo; fecha: { inicio: string } | null }) {
  return (
    <Paper component="section" aria-labelledby="fecha-titulo" sx={{ p: { xs: 2.5, md: 3 }, mb: 3, maxWidth: 900, display: 'grid', gap: 1 }}>
      <Typography id="fecha-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>{`Fecha ${deArticulo(articulo, nombre)}`}</Typography>
      <Typography sx={{ fontSize: 14.5, color: 'text.secondary', lineHeight: 1.55 }}>
        {fecha
          ? `Sale el ${formatoDia.format(new Date(fecha.inicio))} a las ${formatoHora.format(new Date(fecha.inicio))}. Está en la Agenda pública.`
          : `Todavía sin fecha. La ${segunLaCorporacion('decide', 'deciden')} ${laCorporacion({ corto: true })} cada año; hasta que la tenga no se puede abrir la solicitud.`}
      </Typography>
      <Box component={Link} to="/cms/procesion/salidas" sx={{ ...enlace, color: 'primary.main', justifySelf: 'start' }}>Cambiar la fecha en Salidas</Box>
    </Paper>
  )
}

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: ReactNode }) {
  return (
    <Box sx={{ p: 1.75, borderRadius: 1, backgroundColor: 'action.hover', height: '100%' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>{titulo}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
      {detalle && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{detalle}</Typography>}
    </Box>
  )
}
