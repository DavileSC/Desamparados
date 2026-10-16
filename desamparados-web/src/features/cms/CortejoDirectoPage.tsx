import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import StopIcon from '@mui/icons-material/Stop'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import CabeceraSeccion from './CabeceraSeccion'
import { cortejoParaLaJunta, enviarPosicion, terminarDirecto, type CortejoParaLaJunta, type PosicionCortejo } from '../../lib/api/cortejoDirecto'
import { DISTANCIA_MAXIMA_M, lecturaDelRecorrido, puntoEn, sobreElRecorrido } from '../../components/bloques/recorrido'
import { site } from '../../config/site'

/** Cada cuánto, como poco, se manda la posición: el GPS avisa a cada paso y el servidor no lo necesita. */
const CADA_MS = 15_000
/**
 * Parado en una esquina el GPS deja de avisar, y a los diez minutos sin
 * posición la web dejaría de enseñar el directo: se repite la última cada minuto.
 */
const REPITE_MS = 60_000

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * El cortejo en directo, desde el móvil de quien va en la calle: «Empezar»
 * manda la posición del GPS mientras la pantalla siga abierta; si el GPS falla
 * entre fachadas, se marca a mano la parada por la que se va. El mapa del
 * recorrido de la web la recoge sola.
 */
export default function CortejoDirectoPage() {
  const [estado, setEstado] = useState<CortejoParaLaJunta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [siguiendo, setSiguiendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const vigilante = useRef<number | null>(null)
  const repetidor = useRef<number | null>(null)
  const ultima = useRef<{ p: PosicionCortejo; enviadaEn: number } | null>(null)
  const pantalla = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    let cancelado = false
    cortejoParaLaJunta()
      .then((e) => { if (!cancelado) setEstado(e) })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar el directo.')) })
    return () => { cancelado = true }
  }, [])

  // El servidor busca el itinerario con mapa entre las páginas encendidas:
  // no va fijo a una página propia que otra corporación no tiene.
  const itinerario = estado?.recorrido ?? null
  // Lo que se marca a mano: las calles si el recorrido las tiene (como la lista
  // de la web); si no, las paradas, como antes.
  const lectura = itinerario
    ? lecturaDelRecorrido({ paradas: itinerario.paradas, recorrido: { esquinas: [], linea: itinerario.linea, pegado: true, calles: itinerario.calles ?? [] } })
    : null

  const mandar = useCallback(async (p: PosicionCortejo) => {
    ultima.current = { p, enviadaEn: Date.now() }
    try { setEstado(await enviarPosicion(p)); setError(null) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido mandar la posición. Se reintentará con la siguiente.')) }
  }, [])

  const parar = useCallback(() => {
    if (vigilante.current !== null) navigator.geolocation?.clearWatch(vigilante.current)
    if (repetidor.current !== null) window.clearInterval(repetidor.current)
    vigilante.current = null
    repetidor.current = null
    void pantalla.current?.release().catch(() => undefined)
    pantalla.current = null
    setSiguiendo(false)
  }, [])

  // Al salir de la pantalla se deja de mandar: sin ella abierta no hay nadie mirando el GPS.
  useEffect(() => parar, [parar])

  const empezar = async () => {
    if (!('geolocation' in navigator)) { setError('Este navegador no da la posición. Marca a mano las paradas de abajo.'); return }
    setError(null)
    setSiguiendo(true)
    // Que el móvil no apague la pantalla: con ella apagada, el navegador deja de dar posiciones.
    try { pantalla.current = await navigator.wakeLock?.request('screen') ?? null } catch { pantalla.current = null }
    vigilante.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lng: pos.coords.longitude, lat: pos.coords.latitude, precision: Math.round(pos.coords.accuracy) }
        if (!ultima.current || Date.now() - ultima.current.enviadaEn >= CADA_MS) void mandar(p)
        else ultima.current = { ...ultima.current, p }
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED
          ? 'El navegador no deja usar la ubicación. Actívala en los permisos del sitio o marca a mano las paradas de abajo.'
          : 'El GPS no da la posición ahora mismo. Sigue intentándolo; mientras, puedes marcar la parada a mano.')
        // Aplazado: el aviso puede llegar antes de que `watchPosition` devuelva
        // su número, y sin él la vigilancia quedaría abierta.
        if (err.code === err.PERMISSION_DENIED) window.setTimeout(parar)
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    )
    repetidor.current = window.setInterval(() => {
      if (ultima.current && Date.now() - ultima.current.enviadaEn >= REPITE_MS) void mandar(ultima.current.p)
    }, REPITE_MS / 2)
  }

  const terminar = async () => {
    parar()
    setOcupado(true)
    try { setEstado(await terminarDirecto()); ultima.current = null }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido terminar el directo.')) }
    finally { setOcupado(false) }
  }

  const marcarParada = (i: number) => {
    if (!itinerario || !lectura) return
    const { posiciones, porCalles } = lectura
    // Una calle se marca un poco dentro de ella: en su comienzo exacto, la web
    // podría leer la anterior por un metro.
    const f = porCalles ? posiciones[i] + ((posiciones[i + 1] ?? 1) - posiciones[i]) * 0.2 : posiciones[i]
    const [lng, lat] = puntoEn(itinerario.linea, f)
    void mandar({ lng, lat, precision: null })
  }

  // Si el GPS la pone lejos del recorrido, el mapa de la web no la pinta: que lo sepa quien la manda.
  const lejos = itinerario && estado?.enDirecto && estado.lng !== undefined && estado.lat !== undefined
    ? Math.round(sobreElRecorrido(itinerario.linea, [estado.lng, estado.lat]).distancia)
    : 0

  if (!estado) return error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label="Cargando el directo" />

  return <>
    <Helmet><title>{`Cortejo en directo | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Cortejo en directo" subtitulo="Desde el móvil de quien va en la calle: el mapa del recorrido de la web enseña por dónde va.">
      {estado.ruta && <Button variant="outlined" component={Link} to={estado.ruta} target="_blank" startIcon={<OpenInNewIcon />}>Ver el mapa</Button>}
    </CabeceraSeccion>

    <Stack spacing={2.5} sx={{ maxWidth: 640 }}>
      <Paper sx={{ p: 2.5 }} role="status">
        {estado.enDirecto && estado.actualizadoEl
          ? <Typography><strong>En directo.</strong> Última posición a las {hora(estado.actualizadoEl)}{estado.precision !== null ? ` (±${estado.precision} m)` : ', marcada a mano'}{estado.autorNombre ? `, de ${estado.autorNombre}` : ''}.</Typography>
          : estado.enMarcha && estado.actualizadoEl
            ? <Typography><strong>Sin posición desde las {hora(estado.actualizadoEl)}</strong>{estado.autorNombre ? ` (la mandaba ${estado.autorNombre})` : ''}. La web ha vuelto a la reproducción hasta que llegue otra.</Typography>
            : <Typography>El cortejo no está en la calle: la web enseña la reproducción del recorrido.</Typography>}
      </Paper>

      {lejos > DISTANCIA_MAXIMA_M && <Alert severity="warning">La última posición queda a {lejos} m del recorrido: la web no la enseña hasta que vuelva a caer cerca de la línea.</Alert>}
      {error && <Alert severity="warning" onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        {siguiendo
          ? <Button size="large" variant="outlined" onClick={parar}>Dejar de mandar desde este móvil</Button>
          : <Button size="large" variant="contained" startIcon={<MyLocationIcon />} onClick={() => void empezar()}>Empezar a mandar la posición</Button>}
        {(estado.enMarcha || siguiendo) && (
          <Button size="large" color="error" startIcon={<StopIcon />} onClick={() => void terminar()} disabled={ocupado}>Terminar el directo</Button>
        )}
      </Stack>
      {siguiendo && <Typography variant="body2" color="text.secondary">Deja esta pantalla abierta: con el móvil bloqueado o en otra aplicación, el navegador deja de dar la posición.</Typography>}

      {itinerario && (
        <Box>
          <Typography component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>Si el GPS falla: estamos en…</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Pulsa la {lectura?.porCalles ? 'calle' : 'parada'} por la que va el cortejo y el mapa lo pone allí.</Typography>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {lectura?.filas.map((fila, i) => (
              <Button key={`${fila.lugar}-${i}`} variant="outlined" onClick={() => marcarParada(i)} sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none' }}>
                {fila.hora ? `${fila.hora} · ` : ''}{fila.lugar}
              </Button>
            ))}
          </Box>
        </Box>
      )}
      {!itinerario && <Alert severity="info">Ninguna página tiene un itinerario con mapa (Web pública → Páginas, bloque Itinerario con su recorrido dibujado): sin él, la web no puede enseñar la posición.</Alert>}
    </Stack>
  </>
}
