import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogContent, DialogTitle, FormControlLabel, InputAdornment, LinearProgress, Paper, Stack, Tab, Tabs, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import SearchIcon from '@mui/icons-material/Search'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from '../CabeceraSeccion'
import LectorQr from './LectorQr'
import { deshacerEntrada, entrarAMano, escanearPapeleta, estadoPuerta, type Lectura, type PapeletaEnPuerta, type Veredicto } from '../../../lib/api/puerta'
import type { Salida } from '../../../lib/api/salidas'
import AvisoSinSalidas from '../../procesion/AvisoSinSalidas'
import SelectorSalida from '../../procesion/SelectorSalida'
import { useSalidaElegida } from '../../procesion/useSalidas'
import { site } from '../../../config/site'
import { deArticulo, deLaCorporacion } from '../../../domain/articulos'
import { useAuthStore } from '../../altas/auth/store'

/** Las cuentas se refrescan solas: varios diputados escanean a la vez en distintas puertas. */
const SONDEO_MS = 5_000
/** Lo que espera la cámara antes de volver a leer. */
const PAUSA_MS = 1_800
/**
 * Lo que dura el resultado en pantalla. Fijo, el aviso de la papeleta anterior
 * se confundía con la siguiente. El mismo código leído en este tiempo es el
 * mismo gesto (la papeleta sigue delante de la cámara), no otra entrada: con un
 * margen menor, un «Adelante» pasaba solo a «Ya había entrado».
 */
const RESULTADO_MS = 4_000

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
// En hora de Madrid, la de la salida, aunque el móvil del diputado tenga otra zona.
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })
const nombre = (p: PapeletaEnPuerta) => `${p.nombre} ${p.apellidos}`
const sitio = (p: PapeletaEnPuerta) => [p.puesto, p.tramo, p.numero !== null ? `n.º ${p.numero}` : null].filter(Boolean).join(' · ')

const TEXTO: Record<Veredicto, { titulo: string; tono: 'success' | 'warning' | 'error' }> = {
  ENTRA: { titulo: 'Adelante', tono: 'success' },
  REPETIDA: { titulo: 'Ya había entrado', tono: 'warning' },
  OTRA_SALIDA: { titulo: 'Papeleta de otra salida', tono: 'error' },
  DE_BAJA: { titulo: 'De baja en el censo', tono: 'error' },
  ANULADA: { titulo: 'Papeleta anulada', tono: 'error' },
  FALSO: { titulo: 'No es una papeleta válida', tono: 'error' },
}

/** El título de una lectura: el QR de una familia sin papeletas no es una «papeleta anulada». */
function titulo(l: Lectura, tono: { titulo: string }): string {
  if (l.familia && l.veredicto === 'ANULADA') return 'Sin papeletas de esta salida'
  if (l.familia && l.veredicto === 'OTRA_SALIDA') return 'QR de familia de otra salida'
  return tono.titulo
}

function explicacion(l: Lectura, salida: Salida, salidas: Salida[], year?: number): string {
  const p = l.papeleta
  if (l.familia && l.veredicto === 'OTRA_SALIDA') return `Es de otra salida o de otro año, no ${deArticulo(salida.articulo, salida.nombre)}${year ? ` ${year}` : ''}.`
  if (l.familia && l.veredicto === 'ANULADA') return 'Esa familia no tiene papeletas recogidas para esta salida: que pase por la mesa.'
  switch (l.veredicto) {
    case 'FAMILIA': return ''
    case 'ENTRA': return p ? sitio(p) : ''
    case 'REPETIDA': return p?.entradaEl ? `Entró a las ${hora(p.entradaEl)}${p.entradaPor ? `, lo apuntó ${p.entradaPor}` : ''}.` : ''
    case 'OTRA_SALIDA': {
      if (!p) return ''
      // Una salida ya desactivada no está en la lista: se dice sin nombre.
      const otra = salidas.find((s) => s.slug === p.salida)
      return `Es ${otra ? deArticulo(otra.articulo, otra.nombre) : 'de otra salida,'} ${p.year}, no ${deArticulo(salida.articulo, salida.nombre)}${year ? ` ${year}` : ''}.`
    }
    case 'DE_BAJA': return 'Está de baja: no puede salir. Que hable con Secretaría.'
    case 'ANULADA': return 'La papeleta se anuló: que pase por la mesa.'
    case 'FALSO': return `El código no es de una papeleta ${deLaCorporacion({ corto: true })}, o está dañado. Búscalo por su nombre en «Faltan».`
  }
}

function vibrar(v: Lectura['veredicto']) {
  try { navigator.vibrate?.(v === 'ENTRA' || v === 'FAMILIA' ? 60 : [90, 60, 90]) } catch { /* sin vibración */ }
}

/** La puerta no le deja entrar (ni a mano): no se le ofrece, aunque venga en el QR de su familia. */
const puedeEntrar = (p: PapeletaEnPuerta) => !p.entradaEl && !p.deBaja

/** El QR de una familia leído: quiénes son y a quiénes va a dejar pasar el diputado. */
interface FamiliaEnPuerta {
  papeletas: PapeletaEnPuerta[]
  marcadas: Set<number>
}

/**
 * La puerta del templo: el listado de los que faltan por entrar, para buscar
 * a cada uno por su nombre y apuntarlo. Manda el listado (20-10-2026): lo
 * normal será buscar a mano. El QR de la papeleta se lee aparte, con «Leer
 * QR», con la cámara del móvil o con un lector de mano. Todos ven en vivo
 * cuántos faltan por tramo.
 */
export default function PuertaTemploPage() {
  const cliente = useQueryClient()
  const { salidas, salida, elegir, cargando, error: errorSalidas } = useSalidaElegida('puerta.salida')
  // Mientras llegan las salidas, la consulta espera (`enabled`).
  const slug = salida?.slug ?? ''
  const [qrAbierto, setQrAbierto] = useState(false)
  const enMovil = useMediaQuery(useTheme().breakpoints.down('sm'))
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [familia, setFamilia] = useState<FamiliaEnPuerta | null>(null)
  // Los de la familia que acaban de entrar, para decirlo como una lectura más.
  const [entraron, setEntraron] = useState<PapeletaEnPuerta[] | null>(null)
  const [dejandoPasar, setDejandoPasar] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [pestana, setPestana] = useState<'faltan' | 'ultimas'>('faltan')
  const [buscar, setBuscar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ultimo = useRef<{ texto: string; en: number } | null>(null)
  const temporizadores = useRef<{ pausa?: number; resultado?: number }>({})
  useEffect(() => () => {
    window.clearTimeout(temporizadores.current.pausa)
    window.clearTimeout(temporizadores.current.resultado)
  }, [])

  const clave = ['puerta', slug]
  // Con la sesión caducada, el sondeo se para hasta volver a entrar: cada
  // vuelta recibía otro 401 y volvía a preguntar a /auth/me.
  const caducada = useAuthStore((s) => s.cmsCaducada)
  const { data: estado, error: errorCarga } = useQuery({ queryKey: clave, queryFn: () => estadoPuerta(slug), refetchInterval: caducada ? false : SONDEO_MS, staleTime: 0, enabled: Boolean(salida) })
  const refrescar = useCallback(() => cliente.invalidateQueries({ queryKey: ['puerta'] }), [cliente])

  /** Cada resultado empieza su cuenta: el anterior no puede borrar el nuevo antes de tiempo. */
  const contar = useCallback(() => {
    window.clearTimeout(temporizadores.current.pausa)
    window.clearTimeout(temporizadores.current.resultado)
    temporizadores.current.pausa = window.setTimeout(() => setPausado(false), PAUSA_MS)
    temporizadores.current.resultado = window.setTimeout(() => { setLectura(null); setEntraron(null) }, RESULTADO_MS)
  }, [])

  const mostrar = useCallback((l: Lectura) => {
    setError(null)
    setEntraron(null)
    vibrar(l.veredicto)
    setPausado(true)
    if (l.veredicto === 'FAMILIA' && l.familia) {
      // La familia espera a que el diputado diga quién está: ni se borra sola
      // ni se lee otra papeleta encima hasta entonces.
      window.clearTimeout(temporizadores.current.pausa)
      window.clearTimeout(temporizadores.current.resultado)
      setLectura(null)
      setFamilia({ papeletas: l.familia, marcadas: new Set(l.familia.filter(puedeEntrar).map((p) => p.id)) })
      return
    }
    setFamilia(null)
    setLectura(l)
    contar()
    void refrescar()
  }, [contar, refrescar])

  const marcar = (id: number) => setFamilia((f) => {
    if (!f) return f
    const marcadas = new Set(f.marcadas)
    if (marcadas.has(id)) marcadas.delete(id)
    else marcadas.add(id)
    return { ...f, marcadas }
  })

  const cancelarFamilia = () => { setFamilia(null); setPausado(false) }

  /** Entran los marcados, de uno en uno como a mano: el que no vino entra luego con su QR. */
  const dejarPasar = async () => {
    if (!familia) return
    setDejandoPasar(true)
    const resultados = await Promise.allSettled([...familia.marcadas].map((id) => entrarAMano(id, slug)))
    setDejandoPasar(false)
    const dentro = resultados.flatMap((r) => (r.status === 'fulfilled' && r.value.veredicto === 'ENTRA' && r.value.papeleta ? [r.value.papeleta] : []))
    const fallos = resultados.length - dentro.length
    setFamilia(null)
    setEntraron(dentro)
    setError(fallos > 0 ? `${fallos === 1 ? 'Una entrada no se ha podido apuntar' : `${fallos} entradas no se han podido apuntar`}: búscalas en «Faltan».` : null)
    contar()
    void refrescar()
  }

  const leer = useCallback(async (texto: string) => {
    const limpio = texto.trim()
    if (!limpio) return
    const ahora = Date.now()
    if (ultimo.current && ultimo.current.texto === limpio && ahora - ultimo.current.en < RESULTADO_MS) return
    ultimo.current = { texto: limpio, en: ahora }
    try { mostrar(await escanearPapeleta(limpio.slice(0, 64), slug)) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido comprobar la papeleta. Vuelve a intentarlo.')) }
  }, [mostrar, slug])

  const aMano = async (p: PapeletaEnPuerta) => {
    try {
      mostrar(await entrarAMano(p.id, slug))
      // Apuntado el que se buscaba: el buscador, vacío para el siguiente.
      setBuscar('')
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido apuntar la entrada.')) }
  }

  const deshacer = async (p: PapeletaEnPuerta) => {
    try { await deshacerEntrada(p.id); setLectura(null); await refrescar() }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido deshacer la entrada.')) }
  }

  const faltan = useMemo(() => {
    const q = buscar.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    const lista = estado?.faltan ?? []
    if (!q) return lista
    return lista.filter((p) => `${nombre(p)} ${p.numeroHermano ?? ''} ${p.tramo ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q))
  }, [estado, buscar])

  const cambiarSalida = (nueva: string) => { elegir(nueva); setLectura(null); setFamilia(null); setEntraron(null); setError(null) }
  const abrirQr = () => { setLectura(null); setEntraron(null); setError(null); setQrAbierto(true) }
  const cerrarQr = () => { setQrAbierto(false); setFamilia(null); setPausado(false) }
  const tono = lectura && lectura.veredicto !== 'FAMILIA' ? TEXTO[lectura.veredicto] : null
  const porEntrar = familia ? familia.papeletas.filter(puedeEntrar).length : 0
  const familiaDeBaja = familia ? familia.papeletas.some((p) => p.deBaja && !p.entradaEl) : false

  if (cargando) return <CircularProgress aria-label="Cargando la puerta" />
  if (!salida) {
    return <>
      <CabeceraSeccion titulo="Puerta del templo" />
      <AvisoSinSalidas error={errorSalidas} />
    </>
  }

  // El resultado, grande: se lee de un vistazo con la papeleta todavía en la
  // mano. Sale donde se está mirando: en la ventana del QR, o sobre el listado.
  const resultado = (
    <Box role="status" aria-live="assertive">
      {lectura && tono && (
        <Alert severity={tono.tono} variant="filled" sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
          action={lectura.veredicto === 'ENTRA' && lectura.papeleta ? <Button color="inherit" size="small" onClick={() => void deshacer(lectura.papeleta!)}>Deshacer</Button> : undefined}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{titulo(lectura, tono)}</Typography>
          {lectura.papeleta && <Typography sx={{ fontSize: 19, fontWeight: 600, mt: 0.5 }}>{nombre(lectura.papeleta)}{lectura.papeleta.numeroHermano ? ` · n.º ${lectura.papeleta.numeroHermano}` : ''}</Typography>}
          <Typography sx={{ mt: 0.25 }}>{explicacion(lectura, salida, salidas, estado?.year)}</Typography>
        </Alert>
      )}
      {entraron && entraron.length > 0 && (
        <Alert severity="success" variant="filled" sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{entraron.length === 1 ? 'Adelante' : `Adelante, los ${entraron.length}`}</Typography>
          {entraron.map((p) => <Typography key={p.id} sx={{ fontSize: 17, fontWeight: 600, mt: 0.25 }}>{nombre(p)} <Box component="span" sx={{ fontWeight: 400, fontSize: 15 }}>· {sitio(p)}</Box></Typography>)}
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
    </Box>
  )

  /** Una fila del listado: alta de sobra para el dedo, con su botón a la derecha. */
  const fila = (p: PapeletaEnPuerta, detalle: string, accion: ReactNode) => (
    <Box component="li" key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25, minHeight: 64, borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{nombre(p)}</Typography>
        <Typography variant="body2" color="text.secondary">{detalle}</Typography>
      </Box>
      {accion}
    </Box>
  )

  return <>
    <Helmet><title>{`Puerta del templo | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion
      titulo="Puerta del templo"
      subtitulo={estado ? `${salida.nombre} ${estado.year} · ${estado.dentro} de ${estado.total} dentro${estado.deBaja > 0 ? ` · ${estado.deBaja} de baja` : ''}` : salida.nombre}
    >
      <SelectorSalida salidas={salidas} valor={slug} onChange={cambiarSalida} />
    </CabeceraSeccion>

    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 280px' }, alignItems: 'start' }}>
      <Paper component="section" aria-label="Listado de la puerta" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'stretch' }}>
          <TextField
            fullWidth
            label="Buscar por nombre, número o tramo"
            value={buscar}
            onChange={(e) => { setBuscar(e.target.value); setPestana('faltan') }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>, sx: { fontSize: 18 } },
              htmlInput: { autoComplete: 'off', spellCheck: false, enterKeyHint: 'search' },
            }}
          />
          <Button variant="outlined" startIcon={<QrCodeScannerIcon />} onClick={abrirQr} sx={{ flexShrink: 0, whiteSpace: 'nowrap', px: { xs: 1.5, sm: 2.5 } }}>
            Leer QR
          </Button>
        </Stack>

        {!qrAbierto && resultado}
        {errorCarga && !estado && <Alert severity="error">{mensaje(errorCarga, 'No se ha podido cargar la puerta.')}</Alert>}

        {estado && <>
          <Tabs value={pestana} onChange={(_e, v: 'faltan' | 'ultimas') => setPestana(v)} sx={{ mb: 0.5 }}>
            <Tab value="faltan" label={`Faltan (${estado.total - estado.dentro})`} />
            <Tab value="ultimas" label="Últimas entradas" />
          </Tabs>
          {pestana === 'faltan' ? (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {faltan.slice(0, 200).map((p) => fila(p, sitio(p),
                <Button variant="contained" onClick={() => void aMano(p)} sx={{ flexShrink: 0, minHeight: 44 }}>Ha entrado</Button>))}
              {faltan.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>{buscar ? 'Nadie con ese nombre por entrar.' : 'Ya han entrado todos.'}</Typography>}
            </Box>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {estado.ultimas.map((p) => fila(p, `${p.entradaEl ? hora(p.entradaEl) : ''} · ${sitio(p)}${p.entradaPor ? ` · ${p.entradaPor}` : ''}`,
                <Button onClick={() => void deshacer(p)} sx={{ flexShrink: 0, minHeight: 44 }}>Deshacer</Button>))}
              {estado.ultimas.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>Todavía no ha entrado nadie.</Typography>}
            </Box>
          )}
        </>}
      </Paper>

      {estado && (
        <Paper component="section" aria-label="Por tramos" sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>Por tramos</Typography>
          {estado.tramos.length === 0 && <Typography color="text.secondary">No hay papeletas de esta salida todavía.</Typography>}
          <Stack spacing={1.25}>
            {estado.tramos.map((t) => (
              <Box key={t.tramo ?? 'sin-tramo'}>
                <Stack direction="row" sx={{ mb: 0.25, justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.tramo ?? 'Sin tramo'}</Typography>
                  <Typography variant="body2" color="text.secondary">{t.dentro} de {t.total}{t.total > t.dentro ? ` · faltan ${t.total - t.dentro}` : ' · completo'}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={t.total ? (100 * t.dentro) / t.total : 0} aria-label={`${t.tramo ?? 'Sin tramo'}: ${t.dentro} de ${t.total} dentro`} sx={{ height: 8, borderRadius: 4 }} />
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>

    {/* El QR, aparte: la cámara solo se abre al pedirla (el iPhone lo exige, y abierta gasta batería). */}
    <Dialog open={qrAbierto} onClose={cerrarQr} fullScreen={enMovil} fullWidth maxWidth="sm" aria-labelledby="titulo-leer-qr">
      <DialogTitle id="titulo-leer-qr">Leer papeletas</DialogTitle>
      <DialogContent>
        {resultado}

        {/* El QR de una familia: el diputado mira quién está y deja pasar a esos. */}
        {familia && (
          <Paper role="group" aria-label="QR de familia" sx={{ p: 2, mb: 2, border: 2, borderColor: 'success.main' }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700 }}>QR de familia · {familia.papeletas.length} papeletas</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.25, mb: 1 }}>
              {porEntrar > 0 ? 'Desmarca al que no esté: entrará luego con su propia papeleta.'
                : familiaDeBaja ? 'No queda nadie que pueda entrar.' : 'Ya habían entrado todos.'}
            </Typography>
            <Stack>
              {familia.papeletas.map((p) => p.entradaEl
                ? (
                  <Box key={p.id} sx={{ py: 0.75, pl: 4 }}>
                    <Typography sx={{ fontWeight: 600 }}>{nombre(p)}</Typography>
                    <Typography variant="body2" sx={{ color: 'warning.main' }}>Ya entró a las {hora(p.entradaEl)}{p.entradaPor ? `, lo apuntó ${p.entradaPor}` : ''}</Typography>
                  </Box>
                )
                : p.deBaja
                  ? (
                    <Box key={p.id} sx={{ py: 0.75, pl: 4 }}>
                      <Typography sx={{ fontWeight: 600 }}>{nombre(p)}</Typography>
                      <Typography variant="body2" sx={{ color: 'error.main' }}>De baja en el censo: no puede salir. Que hable con Secretaría.</Typography>
                    </Box>
                  )
                : (
                  <FormControlLabel
                    key={p.id}
                    control={<Checkbox checked={familia.marcadas.has(p.id)} onChange={() => marcar(p.id)} />}
                    label={<><Typography component="span" sx={{ fontWeight: 600, display: 'block' }}>{nombre(p)}</Typography><Typography component="span" variant="body2" color="text.secondary">{sitio(p)}</Typography></>}
                    sx={{ py: 0.25, alignItems: 'center' }}
                  />
                ))}
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
              {porEntrar > 0 && (
                <Button variant="contained" color="success" size="large" disabled={familia.marcadas.size === 0 || dejandoPasar} onClick={() => void dejarPasar()} sx={{ flexGrow: 1 }}>
                  {familia.marcadas.size === 1 ? 'Dejar pasar a 1' : `Dejar pasar a los ${familia.marcadas.size}`}
                </Button>
              )}
              <Button variant="outlined" size="large" onClick={cancelarFamilia} disabled={dejandoPasar}>{porEntrar === 0 ? 'Cerrar' : 'Cancelar'}</Button>
            </Stack>
          </Paper>
        )}

        <LectorQr onCodigo={(t) => void leer(t)} pausado={pausado} />

        {/* Un lector de mano escribe el código y pulsa Intro: entra por aquí, como escrito a mano. */}
        <Box component="form" onSubmit={(e) => { e.preventDefault(); void leer(codigo); setCodigo('') }} sx={{ mt: 2 }}>
          <TextField fullWidth size="small" label="Código de la papeleta" value={codigo} onChange={(e) => setCodigo(e.target.value)}
            helperText="Con un lector de mano, o escrito: DSP1.…" slotProps={{ htmlInput: { autoComplete: 'off', autoCapitalize: 'off', spellCheck: false, maxLength: 64 } }} />
        </Box>
        <Button fullWidth variant="outlined" size="large" onClick={cerrarQr} sx={{ mt: 2 }}>Volver al listado</Button>
      </DialogContent>
    </Dialog>
  </>
}
