import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Autocomplete, Box, Checkbox, CircularProgress, FormControlLabel, Radio, RadioGroup, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import {
  anularCita, estadoDelPago, irAlBanco, miProcesion, pagarEnLinea, pedirPapeleta,
  type DiaDeReparto, type EstadoDelPago, type FichaEnLaProcesion, type MetodoEnLinea, type MiProcesion, type SalidaDelHermano,
} from '../../../lib/api/procesion'
import { formatearImporte } from '../recibos/etiquetas'
import { PARENTESCO } from '../perfil/etiquetas'
import AvisoSuave from '../../../components/AvisoSuave'
import { site } from '../../../config/site'
import TarjetaPapeleta from './TarjetaPapeleta'
import { useSalidas } from '../../procesion/useSalidas'
import { conArticulo, deArticulo, laCorporacion, segunLaCorporacion, type Articulo } from '../../../domain/articulos'
import { useModulos } from '../../../hooks/useModulos'

/** El artículo de una salida del catálogo público por su slug: `SalidaDelHermano` no lo trae, así que se busca en `useSalidas()`. */
const articuloDe = (catalogo: { slug: string; articulo: Articulo }[], slug: string): Articulo => catalogo.find((s) => s.slug === slug)?.articulo ?? 'el'

const ZONA = 'Europe/Madrid'
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' })
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

const formatoAnio = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, year: 'numeric' })

/**
 * «Martes 9 de marzo» y «de 18:00 a 21:00». Si el día es de otro año (la
 * Pasión que se pide en otoño es la del año siguiente), lleva el año.
 */
const dia = (turno: { fecha: string }) => {
  const fecha = new Date(turno.fecha)
  const anio = formatoAnio.format(fecha)
  return mayuscula(formatoDia.format(fecha)) + (anio === formatoAnio.format(new Date()) ? '' : ` de ${anio}`)
}
const horas = (turno: { horaInicio: string; horaFin: string }) =>
  `de ${formatoHora.format(new Date(turno.horaInicio))} a ${formatoHora.format(new Date(turno.horaFin))}`

const quienEs = (f: FichaEnLaProcesion) => (f.esTitular ? 'Tú' : f.parentesco ? PARENTESCO[f.parentesco] : 'A tu cargo')
const sitio = (p: { puesto: string; tramo: string | null }) => [p.puesto, p.tramo].filter(Boolean).join(' · ')
const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)

/** Una clave por pago: si la respuesta no llega y se vuelve a pulsar, no se cobra dos veces. */
const nuevaClave = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Las salidas activas del año desde el área de hermanos, cada una con su
 * plazo, que abre Secretaría.
 * Se pide salir para uno mismo y para quienes se tienen a cargo, con el
 * puesto que le gustaría (lo decide el Grupo) y el día del reparto en que se
 * pasa a recoger la papeleta: la papeleta se tiene al recogerla. Para recogerla hay que estar al día con la cuota de
 * hermano: aquí se ve lo que falta y se puede pagar.
 */
export default function ProcesionPage() {
  const { activo } = useModulos()
  const [estado, setEstado] = useState<MiProcesion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [elegida, setElegida] = useState<string | null>(null)
  // Mientras se espera la respuesta del banco no se ofrece pagar otra vez.
  const [comprobando, setComprobando] = useState(false)

  const cargar = useCallback(() => miProcesion().then(setEstado), [])
  // Estable: la vuelta del banco la tiene entre sus dependencias y no debe volver a preguntar en cada render.
  const trasPagar = useCallback(() => void cargar().catch(() => undefined), [cargar])

  useEffect(() => {
    let cancelado = false
    miProcesion()
      .then((datos) => { if (!cancelado) setEstado(datos) })
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar la procesión.')) })
    return () => { cancelado = true }
  }, [])

  const tras = async (texto: string) => {
    setAviso(texto)
    setError(null)
    await cargar().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar la procesión.')))
  }

  // Se abre por la primera salida con el plazo abierto; si no hay ninguna, por la primera.
  const salida = elegida ?? estado?.salidas.find((s) => s.abierto)?.salida ?? estado?.salidas[0]?.salida ?? null
  const actual = estado?.salidas.find((s) => s.salida === salida)

  return (
    <>
      <Helmet><title>{`Procesión | ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h2" component="h1">Papeleta de sitio</Typography>
              {actual && <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{actual.nombre} de {actual.year}.</Typography>}
            </Box>
            <Box component={Link} to="/area-hermano/procesion/historico" sx={{ color: 'primary.light', fontWeight: 600, fontSize: 15 }}>Ver el histórico</Box>
          </Box>

          {estado && actual && (
            <Tabs value={actual.salida} onChange={(_e, v: string) => setElegida(v)} aria-label="Salida" sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
              {estado.salidas.map((s) => <Tab key={s.salida} value={s.salida} label={`${s.nombre}${s.abierto ? ' · abierta' : ''}`} />)}
            </Tabs>
          )}

          {activo('cuotas-en-linea') && <VueltaDelBanco onPagado={trasPagar} onComprobando={setComprobando} />}
          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
          {aviso && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setAviso(null)}>{aviso}</Alert>}
          {!estado && !error && <CircularProgress aria-label="Cargando la procesión" />}

          {estado && estado.salidas.length === 0 && <AvisoSuave>Ahora mismo no hay ninguna salida en preparación.</AvisoSuave>}
          {estado && actual && <Contenido key={actual.salida} estado={estado} salida={actual} comprobando={comprobando} onHecho={(m) => void tras(m)} onError={setError} />}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}

interface PropsContenido {
  estado: MiProcesion
  salida: SalidaDelHermano
  comprobando: boolean
  onHecho: (mensaje: string) => void
  onError: (mensaje: string) => void
}

function Contenido({ estado, salida, comprobando, onHecho, onError }: PropsContenido) {
  const { activo } = useModulos()
  const de = (f: FichaEnLaProcesion) => f.porSalida[salida.salida]
  const apuntadas = estado.fichas.filter((f) => de(f).papeleta || de(f).solicitud)
  const porPedir = estado.fichas.filter((f) => !de(f).papeleta && !de(f).solicitud)
  // Recogida la papeleta, lo primero es la tarjeta con el QR: es lo que se enseña en la puerta.
  const conPapeleta = estado.fichas.filter((f) => de(f).papeleta?.qr)

  return (
    <Box sx={{ display: 'grid', gap: 3, maxWidth: 980 }}>
      {activo('cuotas-en-linea') && <PorPagar estado={estado} salida={salida} comprobando={comprobando} onHecho={onHecho} onError={onError} />}
      {conPapeleta.length > 0 && (
        <Box component="section" aria-label="Papeletas para enseñar en la puerta" sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
          {conPapeleta.map((f) => <TarjetaPapeleta key={f.id} ficha={f} salida={salida} />)}
        </Box>
      )}
      {apuntadas.length > 0 && <Apuntadas fichas={apuntadas} salida={salida} onHecho={onHecho} onError={onError} />}
      {porPedir.length > 0 && (salida.abierto
        ? <Solicitud salida={salida} fichas={porPedir} onHecho={onHecho} onError={onError} />
        : <PlazoCerrado fichas={porPedir} salida={salida} />)}
    </Box>
  )
}

/** Lo que se le dice al hermano a la vuelta del banco, según lo que haya avisado el banco. */
const TRAS_EL_BANCO: Record<Exclude<EstadoDelPago, 'PENDIENTE'>, { tono: 'success' | 'error' | 'warning'; texto: (importe: string) => string }> = {
  PAGADO: { tono: 'success', texto: (i) => `Pago recibido: ${i}. Ya podéis recoger la papeleta en el reparto.` },
  RECHAZADO: { tono: 'error', texto: () => 'El banco no ha hecho el pago y no se te ha cobrado nada. Puedes intentarlo otra vez.' },
  INCIDENCIA: { tono: 'warning', texto: (i) => `El banco ha cobrado ${i}, pero no se ha podido aplicar a lo que debías (quizá ya estaba pagado). Tesorería lo revisará y te devolverá el dinero.` },
}

/** Cada cuánto se pregunta y cuántas veces: el aviso del banco suele llegar antes que el hermano. */
const ESPERA_MS = 2000
const INTENTOS = 10
const COMPROBANDO = 'Comprobando el pago con el banco…'

/**
 * La vuelta de la página del banco (`?pago=<pedido>`). La vuelta no prueba
 * nada: quien da el pago por hecho es el aviso del banco al servidor, que
 * puede llegar unos segundos después. Por eso se pregunta hasta saberlo.
 *
 * Si el pago no se hizo, el banco vuelve con `&resultado=no` y no avisa al
 * servidor: se dice en el acto, sin esperar una respuesta que no va a llegar.
 * Esa vuelta tampoco prueba nada, pero lo único que puede hacer quien la
 * escriba a mano es leer que no ha pagado.
 */
function VueltaDelBanco({ onPagado, onComprobando }: { onPagado: () => void; onComprobando: (si: boolean) => void }) {
  const [params, setParams] = useSearchParams()
  const pedido = params.get('pago')
  const fallido = params.get('resultado') === 'no'
  const [resultado, setResultado] = useState<{ tono: 'info' | 'success' | 'error' | 'warning'; texto: string } | null>(null)

  useEffect(() => {
    if (!pedido) return
    if (fallido) {
      setResultado({ tono: 'error', texto: 'El pago no se ha completado y no se te ha cobrado nada. Puedes intentarlo otra vez.' })
      return
    }
    let cancelado = false
    let intento = 0
    setResultado({ tono: 'info', texto: COMPROBANDO })
    onComprobando(true)
    const terminar = (r: { tono: 'info' | 'success' | 'error' | 'warning'; texto: string }) => {
      setResultado(r)
      onComprobando(false)
    }
    const preguntar = async () => {
      try {
        const { estado, importe } = await estadoDelPago(pedido)
        if (cancelado) return
        if (estado !== 'PENDIENTE') {
          const final = TRAS_EL_BANCO[estado]
          terminar({ tono: final.tono, texto: final.texto(formatearImporte(importe)) })
          if (estado === 'PAGADO') onPagado()
          return
        }
      } catch {
        if (cancelado) return
      }
      intento += 1
      if (intento < INTENTOS) {
        setTimeout(() => void preguntar(), ESPERA_MS)
        return
      }
      terminar({ tono: 'info', texto: 'Aún no tenemos la respuesta del banco. Si has pagado, lo verás aquí en unos minutos; si lo dejaste a medias, no se ha cobrado nada.' })
    }
    void preguntar()
    return () => { cancelado = true; onComprobando(false) }
  }, [pedido, fallido, onPagado, onComprobando])

  if (!resultado) return null
  const cerrar = () => {
    setResultado(null)
    setParams((p) => { p.delete('pago'); p.delete('resultado'); return p }, { replace: true })
  }
  return <Alert severity={resultado.tono} sx={{ mb: 3 }} onClose={resultado.texto === COMPROBANDO ? undefined : cerrar}>{resultado.texto}</Alert>
}

/**
 * Lo que falta por pagar en la familia: las cuotas de hermano (sin ellas no
 * se recoge la papeleta) y lo de cada salida: su cuota o la voluntad prometida. Con la
 * pasarela en línea, se paga desde aquí; si no, en Secretaría o en el reparto.
 */
function PorPagar({ estado, salida, comprobando, onHecho, onError }: { estado: MiProcesion; salida: SalidaDelHermano; comprobando: boolean; onHecho: (m: string) => void; onError: (m: string) => void }) {
  const [pagando, setPagando] = useState(false)
  const [clave] = useState(nuevaClave)
  const { data: catalogo = [] } = useSalidas()
  const lineas = estado.fichas.flatMap((f) => [
    ...f.cuotasPendientes.map((c) => ({ clave: `r-${c.id}`, reciboId: c.id, solicitudId: null, quien: f.nombre, concepto: c.concepto, importe: c.importe, devuelta: c.estado === 'DEVUELTO' })),
    ...estado.salidas
      .map((s) => f.porSalida[s.salida]?.solicitud ?? null)
      .filter((s): s is NonNullable<typeof s> => s !== null && s.pendiente > 0)
      .map((s) => ({ clave: `s-${s.id}`, reciboId: null, solicitudId: s.id, quien: f.nombre, concepto: s.concepto, importe: s.pendiente, devuelta: false })),
  ])
  if (lineas.length === 0) return null
  const total = lineas.reduce((s, l) => s + Math.round(l.importe * 100), 0) / 100

  const pagar = async (metodo: MetodoEnLinea) => {
    setPagando(true)
    try {
      const inicio = await pagarEnLinea({
        reciboIds: lineas.flatMap((l) => (l.reciboId ? [l.reciboId] : [])),
        solicitudIds: lineas.flatMap((l) => (l.solicitudId ? [l.solicitudId] : [])),
        metodo,
      }, clave)
      if (inicio.tipo === 'banco') {
        // Se va a la página del banco: el botón sigue en «Pagando…» hasta que cambie la página.
        irAlBanco(inicio)
        return
      }
      onHecho(`Pago hecho: ${formatearImporte(total)}. Ya podéis recoger la papeleta en el reparto.`)
    } catch (e) {
      onError(mensaje(e, 'No se ha podido hacer el pago.'))
    }
    setPagando(false)
  }
  const pago = estado.pago

  return (
    <TarjetaCristal component="section" aria-label="Pendiente de pago" sx={{ p: { xs: 2.5, md: 3.5 }, display: 'grid', gap: 2 }}>
      <Box>
        <Typography component="h2" sx={{ fontSize: 19, fontWeight: 600 }}>Pendiente de pago</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 14.5, color: 'text.secondary', lineHeight: 1.55 }}>
          {salida.conRopa
            ? 'Para recoger la papeleta y la túnica hay que estar al día con la cuota de hermano.'
            : `Para salir en ${conArticulo(articuloDe(catalogo, salida.salida), salida.nombre)} hay que estar al día con la cuota de hermano.`}
          {' '}Si lo necesitas, habla con Secretaría.
        </Typography>
      </Box>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
        {lineas.map((l) => (
          <Box component="li" key={l.clave} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <span>
              <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{l.concepto}</Typography>
              <Typography component="span" sx={{ display: 'block', fontSize: 13.5, color: 'text.secondary' }}>{l.quien}{l.devuelta ? ' · devuelta por el banco' : ''}</Typography>
            </span>
            <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatearImporte(l.importe)}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography sx={{ color: 'text.secondary', maxWidth: '52ch', fontSize: 14 }}>
          {!pago
            ? 'Puedes pagar en Secretaría o el día del reparto, antes de recoger la papeleta.'
            : pago.pruebas
              ? 'El pago en línea está en pruebas: todavía no se cobra de verdad. También puedes pagar en Secretaría o el día del reparto.'
              : 'Se paga en la página segura del banco. También puedes pagar en Secretaría o el día del reparto.'}
        </Typography>
        {pago && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {pago.metodos.map((m, i) => (
              <Boton key={m} appVariant={i === 0 ? 'primary' : 'claro'} onClick={() => void pagar(m)} disabled={pagando || comprobando}>
                {pagando ? 'Pagando…' : m === 'BIZUM' ? 'Pagar con Bizum' : pago.metodos.length > 1 ? `Pagar ${formatearImporte(total)} con tarjeta` : `Pagar ${formatearImporte(total)}`}
              </Boton>
            ))}
          </Box>
        )}
      </Box>
    </TarjetaCristal>
  )
}

/**
 * Cómo va cada uno: con la solicitud hecha (pendiente de pago o lista para
 * recoger) o con la papeleta, que se tiene al recogerla en la mesa.
 */
function estadoDe(f: FichaEnLaProcesion, salida: string): { texto: string; color: string } {
  const { papeleta, solicitud } = f.porSalida[salida]
  if (papeleta) return { texto: 'Papeleta recogida', color: 'success.main' }
  // Lo de la salida y la cuota de hermano se dicen aparte: con la papeleta
  // pagada, «Pendiente de pago» hacía creer que no constaba el pago.
  if ((solicitud?.pendiente ?? 0) > 0) return { texto: 'Pendiente de pago', color: 'warning.main' }
  if (f.cuotasPendientes.length > 0) return { texto: 'Falta la cuota', color: 'warning.main' }
  return { texto: 'Lista para recoger', color: 'info.main' }
}

function Apuntadas({ fichas, salida, onHecho, onError }: { fichas: FichaEnLaProcesion[]; salida: SalidaDelHermano; onHecho: (m: string) => void; onError: (m: string) => void }) {
  const [anulando, setAnulando] = useState<number | null>(null)
  const { data: catalogo = [] } = useSalidas()
  const articulo = articuloDe(catalogo, salida.salida)

  const cancelar = async (f: FichaEnLaProcesion) => {
    const cita = f.porSalida[salida.salida].solicitud?.cita
    if (!cita) return
    setAnulando(cita.id)
    try {
      await anularCita(cita.id)
      onHecho(`Solicitud cancelada: ${f.nombre} ya no sale en ${conArticulo(articulo, salida.nombre)}.`)
    } catch (e: unknown) {
      onError(mensaje(e, 'No se ha podido cancelar.'))
    } finally {
      setAnulando(null)
    }
  }

  const todasRecogidas = fichas.every((f) => f.porSalida[salida.salida].papeleta)
  return (
    <TarjetaCristal component="section" aria-label="Este año" sx={{ p: { xs: 2.5, md: 3.5 } }}>
      <Typography component="h2" sx={{ fontSize: 19, fontWeight: 600, mb: 2 }}>
        {todasRecogidas ? (fichas.length > 1 ? 'Vuestras papeletas' : 'Tu papeleta') : (fichas.length > 1 ? 'Vuestras solicitudes' : 'Tu solicitud')}
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1.5 }}>
        {fichas.map((f) => {
          const { papeleta, solicitud } = f.porSalida[salida.salida]
          const e = estadoDe(f, salida.salida)
          const cita = solicitud?.cita ?? null
          const puedeCancelar = !papeleta && solicitud && !solicitud.pagada && cita
          return (
            <Box component="li" key={f.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <span>
                <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{f.nombre} {f.apellidos}</Typography>
                <Typography component="span" sx={{ display: 'block', fontSize: 14, color: 'text.secondary' }}>
                  {papeleta ? sitio(papeleta) : `Pediste: ${solicitud!.puesto} (lo ${segunLaCorporacion('confirma', 'confirman')} ${laCorporacion({ corto: true })} en la mesa)`}
                  {!papeleta && cita ? ` · ${dia(cita.turno)}, ${horas(cita.turno)}` : ''}
                </Typography>
              </span>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', color: e.color }}>{e.texto}</Typography>
                {puedeCancelar && (
                  <Boton appVariant="outline" onClick={() => void cancelar(f)} disabled={anulando !== null} aria-label={`Cancelar la solicitud de ${f.nombre}`} sx={{ py: 0.5, px: 1.75, fontSize: 13 }}>
                    {anulando === cita.id ? 'Cancelando…' : 'Cancelar'}
                  </Boton>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
      {!todasRecogidas && (
        <Typography sx={{ mt: 2, fontSize: 13.5, color: 'text.secondary' }}>
          {salida.conRopa
            ? 'La papeleta se recoge el día del reparto, con la túnica: si la tienes en casa del año pasado, tráela. Llevad el DNI.'
            : 'Se va en traje. La papeleta se recoge el día del reparto, cuando se confirma el puesto.'}
        </Typography>
      )}
    </TarjetaCristal>
  )
}

function PlazoCerrado({ fichas, salida }: { fichas: FichaEnLaProcesion[]; salida: SalidaDelHermano }) {
  const { data: catalogo = [] } = useSalidas()
  const articulo = articuloDe(catalogo, salida.salida)
  return (
    <>
      <TarjetaCristal component="section" sx={{ p: { xs: 2.5, md: 3.5 }, display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
        <Box sx={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <EventBusyIcon sx={{ color: 'secondary.main' }} aria-hidden="true" />
        </Box>
        <Box>
          <Typography component="h2" sx={{ fontSize: 21, fontWeight: 600 }}>
            {`La solicitud de papeletas ${deArticulo(articulo, salida.nombre)} aún no está abierta`}
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.6, maxWidth: '64ch' }}>
            Secretaría la abre unas semanas antes del reparto. Cuando se abra podrás pedir aquí la papeleta{fichas.length > 1 ? ' para ti y para quienes tienes a tu cargo' : ''}, con el puesto que te gustaría, y elegir el día en que pasarás a recogerla. Te avisaremos por correo.
          </Typography>
        </Box>
      </TarjetaCristal>
      <Box component="section" aria-label="La última papeleta">
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 600, mb: 0.5 }}>La última vez</Typography>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {fichas.map((f) => {
            const ultima = f.porSalida[salida.salida].ultima
            return (
              <Box component="li" key={f.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', py: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 600 }}>{f.nombre} {f.apellidos}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>{ultima ? `${ultima.year} · ${sitio(ultima)}` : 'Todavía no ha salido'}</Typography>
              </Box>
            )
          })}
        </Box>
      </Box>
    </>
  )
}

/** Plazo abierto: quién sale, en qué puesto le gustaría y qué día pasa a recogerla. */
function Solicitud({ salida, fichas, onHecho, onError }: { salida: SalidaDelHermano; fichas: FichaEnLaProcesion[]; onHecho: (m: string) => void; onError: (m: string) => void }) {
  const conDonativo = salida.cobro === 'DONATIVO'
  // Los puestos que se pueden pedir: el catálogo de la salida, el mismo que ofrece la mesa.
  const { data: catalogo = [] } = useSalidas()
  const opcionesPuesto = catalogo.find((s) => s.slug === salida.salida)?.puestos.map((p) => p.nombre) ?? []
  const pueden = fichas.filter((f) => f.activo)
  const [marcadas, setElegidas] = useState<number[]>(() => pueden.map((f) => f.id))
  // Tras pedir, las que ya tienen papeleta salen de esta lista: no cuentan aunque sigan marcadas.
  const elegidas = marcadas.filter((id) => pueden.some((f) => f.id === id))
  const [puestos, setPuestos] = useState<Record<number, string>>(() =>
    Object.fromEntries(fichas.map((f) => [f.id, f.porSalida[salida.salida].ultima?.puesto ?? ''])))
  const [donativo, setDonativo] = useState('')
  const [turnoId, setTurnoId] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)

  const libres = (d: DiaDeReparto) => d.capacidad - d.genteApuntada
  const diaElegido = salida.dias.find((d) => d.id === turnoId) ?? null
  const cuantas = elegidas.length
  const nombres = pueden.filter((f) => elegidas.includes(f.id)).map((f) => f.nombre)
  const sinPuesto = elegidas.some((id) => !puestos[id]?.trim())
  const importeDonativo = donativo.trim() ? Number(donativo.replace(',', '.')) : 0
  const donativoValido = !conDonativo || (Number.isFinite(importeDonativo) && importeDonativo >= 0 && importeDonativo <= 1000)
  const cuotaSalida = salida.cuotaSalida ?? 0

  const alternar = (id: number) => setElegidas((actuales) => (actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]))

  const pedir = async () => {
    if (!turnoId || cuantas === 0) return
    setEnviando(true)
    const fallos: string[] = []
    // Una a una: si una ficha ya tenía papeleta o el día se llena a mitad, las demás siguen.
    for (const id of elegidas) {
      try {
        await pedirPapeleta({ hermanoId: id, turnoId, puesto: puestos[id].trim(), ...(conDonativo && { donativo: Math.round(importeDonativo * 100) / 100 }) })
      } catch (e: unknown) {
        const nombre = pueden.find((f) => f.id === id)?.nombre ?? ''
        fallos.push(`${nombre}: ${mensaje(e, 'no se ha podido pedir')}`)
      }
    }
    setEnviando(false)
    if (fallos.length > 0) onError(fallos.join(' '))
    if (fallos.length < cuantas) onHecho(cuantas - fallos.length > 1 ? 'Papeletas pedidas. Os esperamos el día del reparto.' : 'Papeleta pedida. Te esperamos el día del reparto.')
  }

  const leyenda = { fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'secondary.main', px: 0.75 } as const

  return (
    <>
      <Alert severity="success" icon={<EventAvailableIcon />}>
        <strong>{`La solicitud de papeletas ${deArticulo(articuloDe(catalogo, salida.salida), salida.nombre)} está abierta.`}</strong> Elige quién sale, en qué puesto os gustaría ir y el día en que pasaréis a recogerla.
      </Alert>

      {salida.dias.length === 0 ? (
        <AvisoSuave>Todavía no hay días de reparto publicados. Vuelve en unos días.</AvisoSuave>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3, alignItems: 'start' }}>
          <TarjetaCristal component="fieldset" sx={{ m: 0, p: { xs: 2.5, md: 3 }, display: 'grid', gap: 1.25, minWidth: 0 }}>
            <Typography component="legend" sx={leyenda}>1 · Quién sale y en qué puesto</Typography>
            {fichas.map((f) => {
              const ultima = f.porSalida[salida.salida].ultima
              const marcada = elegidas.includes(f.id)
              return (
                <Box key={f.id} sx={{ px: 1, py: 0.75, borderRadius: '8px', border: 1, borderColor: 'divider', display: 'grid', gap: 1 }}>
                  <FormControlLabel
                    disabled={!f.activo}
                    control={<Checkbox checked={marcada} onChange={() => alternar(f.id)} />}
                    sx={{ m: 0, alignItems: 'center' }}
                    label={
                      <span>
                        <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{f.nombre} {f.apellidos}</Typography>
                        <Typography component="span" sx={{ display: 'block', fontSize: 13, color: 'text.secondary' }}>
                          {f.activo
                            ? `${quienEs(f)} · ${ultima ? `la última vez: ${sitio(ultima)}` : 'primera vez'}`
                            : 'Podrá salir cuando Secretaría apruebe su alta'}
                        </Typography>
                      </span>
                    }
                  />
                  {marcada && (
                    <Autocomplete
                      freeSolo
                      autoSelect
                      options={opcionesPuesto}
                      value={puestos[f.id] ?? ''}
                      onChange={(_e, v) => setPuestos({ ...puestos, [f.id]: v ?? '' })}
                      onInputChange={(_e, v, motivo) => { if (motivo === 'input') setPuestos({ ...puestos, [f.id]: v }) }}
                      renderInput={(params) => <TextField {...params} size="small" label={`Puesto que le gustaría a ${f.nombre}`} />}
                    />
                  )}
                </Box>
              )
            })}
            {conDonativo && (
              <TextField
                size="small" label="La voluntad (opcional)" placeholder="0" value={donativo} onChange={(e) => setDonativo(e.target.value)}
                error={!donativoValido} helperText={donativoValido ? 'En euros, por persona. Se da en el reparto o se paga aquí.' : 'Un importe entre 0 y 1000 €'}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            )}
          </TarjetaCristal>

          <TarjetaCristal component="fieldset" sx={{ m: 0, p: { xs: 2.5, md: 3 }, minWidth: 0 }}>
            <Typography component="legend" sx={leyenda}>2 · Día del reparto</Typography>
            <RadioGroup value={turnoId ?? ''} onChange={(e) => setTurnoId(Number(e.target.value))} sx={{ gap: 1.25 }}>
              {salida.dias.map((d) => {
                const quedan = libres(d)
                const lleno = quedan < Math.max(cuantas, 1)
                return (
                  <FormControlLabel
                    key={d.id}
                    value={d.id}
                    disabled={lleno}
                    control={<Radio />}
                    sx={{ m: 0, px: 1, py: 0.75, borderRadius: '8px', border: 1, borderColor: d.id === turnoId ? 'primary.light' : 'divider' }}
                    label={
                      <span>
                        <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{dia(d)}</Typography>
                        <Typography component="span" sx={{ display: 'block', fontSize: 13, color: 'text.secondary' }}>
                          {mayuscula(horas(d))} · {lleno ? 'completo' : quedan <= 10 ? `quedan ${quedan} huecos` : `${d.genteApuntada} apuntados`}
                        </Typography>
                      </span>
                    }
                  />
                )
              })}
            </RadioGroup>
          </TarjetaCristal>
        </Box>
      )}

      {salida.dias.length > 0 && (
        <TarjetaCristal sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography sx={{ color: 'text.secondary', maxWidth: '62ch' }}>
            {cuantas === 0 ? 'Elige quién sale.' : sinPuesto ? 'Di en qué puesto os gustaría ir.' : !diaElegido ? `${nombres.join(' y ')}: elige el día del reparto.` : `${nombres.join(' y ')} · ${dia(diaElegido)}, ${horas(diaElegido)}.`}
            {cuotaSalida > 0 && ` La papeleta cuesta ${formatearImporte(cuotaSalida)}.`}
          </Typography>
          <Boton onClick={() => void pedir()} disabled={enviando || cuantas === 0 || !diaElegido || sinPuesto || !donativoValido}>
            {enviando ? 'Pidiendo…' : cuantas > 1 ? `Pedir ${cuantas} papeletas` : 'Pedir la papeleta'}
          </Boton>
        </TarjetaCristal>
      )}
    </>
  )
}
