import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import { useReducedMotion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as Mapa, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../mapa/trabajador'
import { GOLD, GRANATE } from '../../features/inicio/estilos'
import { ATRIBUCION, cargarBarrio, centroDe, edificioDelTemplo, mapaVivo } from '../mapa/barrio'
import { estiloDelMapa } from '../mapa/estilo'
import { useModoEdicion } from './modoEdicion'
import { useModulos } from '../../hooks/useModulos'
import { anchoMaximo } from './presentacion'
import { ALTO_LISTA, ALTO_MAPA, ALTO_MINIMO, ALTO_MINIMO_LISTA } from './EsqueletoDelRecorrido'
import { DISTANCIA_MAXIMA_M, acumulados, lecturaDelRecorrido, metros, paradaAlcanzada, sobreElRecorrido, tramoHasta, type SitioDelRecorrido } from './recorrido'
import { cortejoEnDirecto } from '../../lib/api/cortejoDirecto'
import type { BloqueItinerario, Coordenada, RecorridoEnMapa as Recorrido, VarianteDelRecorrido } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'
import { horaEnMadrid } from '../../lib/horaDeMadrid'

/** Lo que tarda el play en andar el recorrido entero: despacio, para verlo. */
const DURACION_PLAY_MS = 60_000
/** Cada cuánto se pregunta dónde va el cortejo cuando está en la calle. */
const SONDEO_MS = 20_000
/** La hora de la última posición del cortejo, la de Madrid, se mire desde donde se mire. */
const horaCorta = (iso: string) => horaEnMadrid(iso)
/** La cámara que sigue al trono: cerca e inclinada, con los edificios en relieve. */
const CAMARA_CERCA = { zoom: 16.6, pitch: 52, bearing: -12 }
const GRANATE_CLARO = MARCA.principalClaro
/** El granate de la marca, aclarado para leerse sobre el fondo oscuro (5,4:1). */
const BURDEOS_LEGIBLE = MARCA.principalLegible
/** Un sitio de interés se marca «ahora» mientras el trono está a menos de esta fracción pasado él. */
const SITIO_AHORA = 0.03
/** El recorrido entero, con aire abajo: ahí van el play y los botones de la cámara. */
const MARGEN_ENTERO = { top: 48, right: 48, left: 48, bottom: 88 }

type Camara = 'sigue' | 'entero'

/** Lo que ocupa el recorrido en el mapa. */
function cajaDe(linea: Coordenada[]) {
  const caja = new maplibregl.LngLatBounds(linea[0], linea[0])
  linea.forEach((p) => caja.extend(p))
  return caja
}

/**
 * El itinerario sobre el mapa del barrio (OpenStreetMap, servido desde la
 * propia web). A un lado el mapa, quieto mientras se lee; al otro, las paradas.
 *
 * El recorrido anda solo con el play, despacio (un minuto entero): la línea
 * se dibuja por las calles, el trono (un punto granate) avanza y la lista de al
 * lado se desliza a su par, con la calle por la que va en el centro. Con las
 * calles guardadas (16-10-2026), la lista son las calles y cambia cuando el
 * trono entra en otra; las paradas pasan a sitios de interés, numerados en el
 * mapa y en una fila debajo (`lecturaDelRecorrido`). Sin calles, la lista son
 * las paradas, como antes. Se puede pausar, volver a empezar y elegir si la cámara sigue al
 * trono o enseña el recorrido entero. Antes iba con el scroll de la página,
 * pero se pasaba en un momento: ahora el scroll solo mueve la página.
 *
 * Con «reducir movimiento» la cámara empieza enseñando el recorrido entero y
 * no se desliza. En la vista en vivo del constructor sale entero y dibujado.
 */
export default function RecorridoEnMapa({ bloque, enUso = 'habitual', onSinMapa }: {
  bloque: BloqueItinerario & { recorrido: Recorrido }
  /** Cuál de los dos recorridos es este: si el directo dice otro, la página se vuelve a pedir. */
  enUso?: VarianteDelRecorrido
  /** Esta instalación no tiene mapa del barrio: quien lo pinta enseña las paradas de otra forma. */
  onSinMapa?: () => void
}) {
  // Las filas de la lista (calles o paradas), dónde empieza cada una, los sitios y sus horas.
  const { filas, posiciones, sitios, porCalles } = useMemo(
    () => lecturaDelRecorrido({ paradas: bloque.paradas, recorrido: bloque.recorrido }),
    [bloque.paradas, bloque.recorrido],
  )
  // Por una referencia: el mapa se crea una vez y no debe rehacerse porque
  // cambie la función.
  const avisarSinMapa = useRef(onSinMapa)
  avisarSinMapa.current = onSinMapa
  const linea = bloque.recorrido.linea
  const reducir = useReducedMotion() ?? false
  const enConstructor = useModoEdicion() !== null
  const { activo } = useModulos()

  const [camara, setCamara] = useState<Camara>(reducir || enConstructor ? 'entero' : 'sigue')
  const [reproduciendo, setReproduciendo] = useState(false)
  const [alcanzada, setAlcanzada] = useState(enConstructor ? filas.length - 1 : -1)
  /** Los sitios ya alcanzados, y el que el trono acaba de alcanzar (−1 si ninguno). */
  const [sitiosPasados, setSitiosPasados] = useState(enConstructor ? sitios.length : 0)
  const [sitioAhora, setSitioAhora] = useState(-1)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState(false)

  // El cortejo en la calle: mientras lo esté, el trono va donde diga el móvil
  // de la Junta y el play se retira. En el constructor no se pregunta. Solo
  // sigue preguntando el mapa de la página del recorrido (la dice el
  // servidor): otro itinerario por el mismo barrio no es el del cortejo.
  const { pathname } = useLocation()
  const aqui = pathname.replace(/\/+$/, '') || '/'
  const directo = useQuery({
    queryKey: ['cortejo-directo'],
    queryFn: cortejoEnDirecto,
    refetchInterval: (q) => (q.state.data?.ruta === aqui ? SONDEO_MS : false),
    staleTime: 0,
    enabled: !enConstructor && activo('cortejo-directo'),
  })
  const enCalle = useMemo(() => {
    const d = directo.data
    if (!d?.enDirecto || d.ruta !== aqui || d.lng === undefined || d.lat === undefined || !d.actualizadoEl) return null
    const sobre = sobreElRecorrido(linea, [d.lng, d.lat])
    return sobre.distancia <= DISTANCIA_MAXIMA_M ? { fraccion: sobre.fraccion, hora: horaCorta(d.actualizadoEl) } : null
  }, [directo.data, aqui, linea])
  // La Junta ha cambiado de recorrido en plena salida (desde «Cortejo en
  // directo»): quien tiene la página abierta no tiene que recargarla.
  const consultas = useQueryClient()
  const enUsoDelDirecto = directo.data?.ruta === aqui ? directo.data.enUso : null
  useEffect(() => {
    if (enUsoDelDirecto && enUsoDelDirecto !== enUso) void consultas.invalidateQueries({ queryKey: ['contenido'] })
  }, [enUsoDelDirecto, enUso, consultas])
  const enCalleRef = useRef(enCalle)
  useEffect(() => { enCalleRef.current = enCalle }, [enCalle])

  // Con el cortejo en la calle, el enlace se comparte en redes para verlo por
  // dónde va: quien lo abre cae directamente en el mapa, sin bajar por la
  // cabecera. Una sola vez por visita, para no quitarle la pantalla a quien
  // ya está leyendo; sin directo, la página se abre arriba como siempre.
  const bloqueRef = useRef<HTMLDivElement>(null)
  const yaLlevado = useRef(false)
  useEffect(() => {
    if (!listo || !enCalle || yaLlevado.current) return
    yaLlevado.current = true
    bloqueRef.current?.scrollIntoView({ block: 'start' })
  }, [listo, enCalle])

  const hechos = useMemo(() => acumulados(linea), [linea])
  const posicionesSitios = useMemo(() => sitios.map((sitio) => sitio.posicion), [sitios])
  const circular = linea.length > 1 && metros(linea[0], linea[linea.length - 1]) < 40

  const contenedor = useRef<HTMLDivElement>(null)
  /** La caja de la lista: solo se desliza con el trono, nunca a mano. */
  const caja = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLOListElement>(null)
  const mapa = useRef<Mapa | null>(null)
  const trono = useRef<Marker | null>(null)
  // Lo que cambia en cada fotograma va en refs: repintar el bloque 60 veces por
  // segundo sobraría. El estado solo cambia al alcanzar otra fila o sitio.
  const fraccion = useRef(enConstructor ? 1 : 0)
  const objetivo = useRef<Coordenada>(linea[0])
  const centro = useRef<Coordenada>(linea[0])
  const play = useRef<{ desde: number; inicio: number } | null>(null)
  const etiqueta = useRef<HTMLSpanElement | null>(null)
  /** El rótulo «Salida y entrada»: se aparta cuando el trono pasa por su lado. */
  const rotuloSalida = useRef<HTMLSpanElement | null>(null)
  const camaraActual = useRef(camara)
  // Al día tras cada pintado y antes que los efectos que la leen; no durante el pintado.
  useLayoutEffect(() => { camaraActual.current = camara }, [camara])
  /** Hasta cuándo dura el cambio de plano en curso. MapLibre 6 ya no expone
   *  `isEasing()` en el mapa, así que se lleva la cuenta aquí. */
  const planoHasta = useRef(0)

  /** Pone el trono y la línea en esa fracción del recorrido. */
  const pinta = useCallback((f: number) => {
    fraccion.current = f
    const m = mapa.current
    if (!m || !mapaVivo(m)) return
    const tramo = tramoHasta(linea, f, hechos)
    const dibujo = tramo.length > 1 ? tramo : [tramo[0], tramo[0]]
    ;(m.getSource('rutaHecha') as GeoJSONSource | undefined)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: dibujo } })
    objetivo.current = dibujo[dibujo.length - 1]
    trono.current?.setLngLat(objetivo.current)
    const hasta = paradaAlcanzada(posiciones, f)
    setAlcanzada(hasta)
    const sitio = paradaAlcanzada(posicionesSitios, f)
    setSitiosPasados(sitio + 1)
    setSitioAhora(sitio >= 0 && f - posicionesSitios[sitio] < SITIO_AHORA ? sitio : -1)
    // Con el trono cerca de la salida y el nombre de su calle al lado, los dos
    // rótulos se pisarían: el de la salida se aparta hasta que el trono se aleja.
    if (rotuloSalida.current) rotuloSalida.current.style.opacity = hasta >= 0 && metros(objetivo.current, linea[0]) < 70 ? '0' : '1'
  }, [linea, hechos, posiciones, posicionesSitios])

  /**
   * Desliza la lista a la par del trono: entre dos paradas, a la altura
   * proporcional entre sus filas, de modo que la calle por la que va queda en
   * el centro de la caja. Sin suavizado propio: ya lo lleva el trono.
   */
  const sigueLaLista = useCallback((f: number) => {
    const c = caja.current, ol = lista.current
    if (!c || !ol || ol.children.length === 0) return
    const filas = Array.from(ol.children) as HTMLElement[]
    const centros = filas.map((fila) => fila.offsetTop + fila.offsetHeight / 2)
    let y = centros[0]
    if (f >= posiciones[posiciones.length - 1]) y = centros[centros.length - 1]
    else {
      const i = posiciones.findIndex((p, k) => f >= p && f < (posiciones[k + 1] ?? Infinity))
      if (i >= 0) {
        const t = (f - posiciones[i]) / Math.max(1e-9, posiciones[i + 1] - posiciones[i])
        y = centros[i] + t * (centros[i + 1] - centros[i])
      }
    }
    c.scrollTop = y - c.clientHeight / 2
  }, [posiciones])

  // El mapa: se crea una vez, cuando llegan los datos del barrio.
  useEffect(() => {
    let vivo = true
    let creado: Mapa | null = null
    let medidor: ResizeObserver | null = null
    cargarBarrio().then((barrio) => {
      if (!vivo || !contenedor.current) return
      if (!barrio) {
        avisarSinMapa.current?.()
        return
      }
      // La iglesia de la que sale y a la que vuelve: se destaca, con el rótulo encima.
      const templo = edificioDelTemplo(barrio, linea[0])
      const m = new maplibregl.Map({
        container: contenedor.current,
        style: estiloDelMapa(barrio, templo),
        interactive: false,
        attributionControl: false,
        center: linea[0],
        ...(camaraActual.current === 'sigue' ? CAMARA_CERCA : { zoom: 15 }),
      })
      creado = m
      mapa.current = m
      m.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: ATRIBUCION }), 'bottom-right')
      // El mapa se mide al crearse, y a veces es antes de que su caja tenga el
      // tamaño final (la hoja de estilos de MapLibre llega con él): se vuelve a
      // medir cada vez que la caja cambia.
      medidor = new ResizeObserver(() => {
        m.resize()
        // Con el recorrido entero a la vista, se vuelve a encuadrar al nuevo tamaño.
        if (camaraActual.current === 'entero') m.fitBounds(cajaDe(linea), { padding: MARGEN_ENTERO, pitch: 0, bearing: 0, duration: 0 })
      })
      medidor.observe(contenedor.current)

      const salida = document.createElement('div')
      salida.setAttribute('aria-hidden', 'true')
      // Sin la cruz encima (16-10-2026): la iglesia ya va iluminada.
      salida.innerHTML = `<span style="display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};background:rgba(7,6,8,.85);padding:3px 8px;border:1px solid ${alfa(MARCA.acento, .5)};white-space:nowrap;transition:opacity .4s">${circular ? 'Salida y entrada' : 'Salida'}</span>`
      // Un poco por encima del punto: al salir y al volver, el trono está
      // justo ahí con el nombre de su calle al lado, y no deben pisarse.
      new maplibregl.Marker({ element: salida, anchor: 'bottom', offset: [0, -16] }).setLngLat(templo ? centroDe(templo) : linea[0]).addTo(m)
      rotuloSalida.current = salida.querySelector('span')

      const punto = document.createElement('div')
      punto.setAttribute('aria-hidden', 'true')
      Object.assign(punto.style, {
        width: '18px', height: '18px', borderRadius: '50%', background: GRANATE, border: `2px solid ${GRANATE_CLARO}`,
        boxShadow: `0 0 0 7px ${alfa(MARCA.principalClaro, .22)}, 0 0 18px ${alfa(MARCA.principalClaro, .5)}`,
      })
      // La calle por la que va, pequeña y al lado del trono: no tapa el mapa.
      const nombre = document.createElement('span')
      Object.assign(nombre.style, {
        position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap',
        maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 7px', fontSize: '11.5px',
        color: '#fff', background: 'rgba(7,6,8,.82)', borderLeft: `2px solid ${GOLD}`, fontFamily: 'inherit',
      })
      punto.appendChild(nombre)
      etiqueta.current = nombre
      trono.current = new maplibregl.Marker({ element: punto }).setLngLat(linea[0]).addTo(m)

      m.on('load', () => {
        if (!vivo) return
        ;(m.getSource('rutaEntera') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: linea } })
        setListo(true)
      })
    }).catch(() => { if (vivo) setError(true) })
    return () => {
      vivo = false
      medidor?.disconnect()
      creado?.remove()
      mapa.current = null
      trono.current = null
      etiqueta.current = null
      rotuloSalida.current = null
      setListo(false)
    }
  }, [linea, circular])

  // El nombre de la calle junto al trono.
  useEffect(() => {
    const el = etiqueta.current
    if (!el) return
    const fila = alcanzada >= 0 ? filas[alcanzada] : null
    el.textContent = fila ? `${fila.hora ? `${fila.hora} · ` : ''}${fila.lugar}` : ''
    el.style.display = fila ? 'block' : 'none'
  }, [alcanzada, filas, listo])

  // Las paradas en el mapa: encendidas hasta la alcanzada. Con calles no hay
  // un punto en cada cambio de calle (no gustaron): solo los sitios, numerados.
  useEffect(() => {
    if (!listo || !mapaVivo(mapa.current)) return
    const hechas = enConstructor ? filas.length - 1 : alcanzada
    ;(mapa.current?.getSource('paradas') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: porCalles ? [] : posiciones.map((f, i) => ({
        type: 'Feature', properties: { hecha: i <= hechas },
        geometry: { type: 'Point', coordinates: tramoHasta(linea, f, hechos).at(-1)! },
      })),
    })
  }, [listo, alcanzada, posiciones, linea, hechos, filas.length, enConstructor, porCalles])

  // Los sitios de interés en el mapa: su número en oro, el mismo que en la fila de debajo.
  const marcasSitios = useRef<HTMLDivElement[]>([])
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m || !mapaVivo(m)) return
    const marcas = posicionesSitios.map((f, i) => {
      const el = document.createElement('div')
      el.setAttribute('aria-hidden', 'true')
      el.textContent = String(i + 1)
      Object.assign(el.style, {
        width: '24px', height: '24px', borderRadius: '50%', display: 'grid', placeItems: 'center',
        fontSize: '12px', fontWeight: '700', lineHeight: '1', color: GOLD, background: 'rgba(7,6,8,.9)', border: `2px solid ${GOLD}`,
        transition: 'box-shadow .4s ease',
      })
      return { el, marca: new maplibregl.Marker({ element: el }).setLngLat(tramoHasta(linea, f, hechos).at(-1)!).addTo(m) }
    })
    marcasSitios.current = marcas.map((x) => x.el)
    return () => { marcas.forEach((x) => x.marca.remove()); marcasSitios.current = [] }
  }, [listo, posicionesSitios, linea, hechos])
  useEffect(() => {
    marcasSitios.current.forEach((el, i) => { el.style.boxShadow = i === sitioAhora ? `0 0 0 6px ${alfa(MARCA.acento, 0.25)}, 0 0 16px ${alfa(MARCA.acento, 0.6)}` : 'none' })
  }, [sitioAhora, listo, posicionesSitios])

  // Primera pintura: el trono en la salida (en el constructor, el recorrido entero).
  useEffect(() => {
    if (listo) pinta(enConstructor ? 1 : fraccion.current)
  }, [listo, enConstructor, pinta])

  // Cada posición nueva del directo: el trono, la línea hecha y la lista, allí.
  useEffect(() => {
    if (!listo || !enCalle) return
    play.current = null
    pinta(enCalle.fraccion)
    sigueLaLista(enCalle.fraccion)
  }, [listo, enCalle, pinta, sigueLaLista])

  // El reloj: el play y la cámara que sigue al trono sin dar saltos.
  useEffect(() => {
    if (!listo) return
    let marco = 0
    const paso = (ahora: number) => {
      const p = play.current
      if (p && !enCalleRef.current) {
        const f = Math.min(1, p.desde + (ahora - p.inicio) / DURACION_PLAY_MS)
        pinta(f)
        sigueLaLista(f)
        if (f >= 1) { play.current = null; setReproduciendo(false) }
      }
      const m = mapa.current
      // Mientras la cámara cambia de plano (acercarse al trono, alejarse al
      // recorrido entero) no se la mueve: un salto la cortaría a medias y se
      // quedaría inclinada a medio zoom. Al acabar, sigue al trono desde ahí.
      if (m && mapaVivo(m) && camaraActual.current === 'sigue' && performance.now() >= planoHasta.current) {
        const [ox, oy] = objetivo.current
        const [cx, cy] = centro.current
        centro.current = reducir ? [ox, oy] : [cx + (ox - cx) * 0.12, cy + (oy - cy) * 0.12]
        if (Math.abs(centro.current[0] - cx) > 1e-9 || Math.abs(centro.current[1] - cy) > 1e-9) m.jumpTo({ center: centro.current })
      }
      marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
  }, [listo, pinta, sigueLaLista, reducir])

  // Cambio de cámara: al trono, de cerca, o el recorrido entero desde arriba.
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m || !mapaVivo(m)) return
    const duracion = reducir ? 0 : 1200
    planoHasta.current = performance.now() + duracion
    if (camara === 'entero') {
      m.fitBounds(cajaDe(linea), { padding: MARGEN_ENTERO, pitch: 0, bearing: 0, duration: duracion })
    } else {
      centro.current = objetivo.current
      m.easeTo({ center: objetivo.current, ...CAMARA_CERCA, duration: duracion })
    }
  }, [camara, listo, linea, reducir])

  const alternaPlay = () => {
    if (play.current) { play.current = null; setReproduciendo(false); return }
    const desde = fraccion.current >= 0.999 ? 0 : fraccion.current
    play.current = { desde, inicio: performance.now() }
    setReproduciendo(true)
  }

  /** Volver a empezar: de cero, no marcha atrás. El trono aparece en la salida, la línea se borra y la lista sube arriba. */
  const volverAEmpezar = () => {
    play.current = null
    setReproduciendo(false)
    pinta(0)
    if (caja.current) caja.current.scrollTop = 0
    centro.current = linea[0]
    if (camaraActual.current === 'sigue') mapa.current?.jumpTo({ center: linea[0] })
  }

  const actual = alcanzada >= 0 ? filas[alcanzada] : null
  // Sin ninguna hora, «hora por confirmar» en cada calle recargaba la lista:
  // se dice una vez arriba y la lista va solo con las calles.
  const sinHoras = filas.every((fila) => fila.hora === '')
  const botonMapa = {
    width: 34, height: 34, color: '#fff', backgroundColor: 'rgba(7, 6, 8, .85)', border: '1px solid rgba(204, 196, 201, .3)',
    '&:hover': { backgroundColor: 'rgba(7, 6, 8, .95)', borderColor: GOLD },
  }

  return (
    <Box ref={bloqueRef} sx={{ maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto', scrollMarginTop: { xs: 72, md: 96 } }}>
      <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, color: '#e3d8bf', fontSize: 14 }}>
        <PlayArrowIcon sx={{ fontSize: 20, color: GOLD }} aria-hidden="true" />
        {enCalle
          ? 'El cortejo está en la calle: el punto granate es por donde va ahora, y se actualiza solo.'
          : <>Dale al play para ver el recorrido andar por las calles.{sinHoras ? ' Las horas, por confirmar.' : porCalles && ' Las horas son aproximadas.'}</>}
      </Typography>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.45fr) minmax(0, 1fr)' },
        columnGap: { md: 7 },
      }}
    >
      <Box
        sx={{
          position: 'relative', zIndex: 3,
          height: ALTO_MAPA, minHeight: ALTO_MINIMO,
          mb: { xs: 2, md: 0 }, overflow: 'hidden', border: '1px solid rgba(204, 196, 201, 0.14)', backgroundColor: '#0b0a0c',
          // El reconocimiento a OpenStreetMap que pide su licencia (ODbL): siempre
          // a la vista, legible sobre el mapa oscuro y con el enlace a sus
          // condiciones. No se pliega en un botón «i». Con las dos clases, para
          // ganar a la hoja de MapLibre, que le pone un fondo blanco a medias.
          '& .maplibregl-ctrl.maplibregl-ctrl-attrib': { backgroundColor: 'rgba(7, 6, 8, .88)', padding: '3px 8px', borderTopLeftRadius: '4px' },
          '& .maplibregl-ctrl-attrib-inner': { color: '#e4e2df', fontSize: 12, lineHeight: 1.4 },
          '& .maplibregl-ctrl-attrib a': { color: '#e4e2df', textDecoration: 'underline', textUnderlineOffset: '2px' },
          '& .maplibregl-ctrl-attrib a:hover': { color: GOLD },
        }}
      >
        {/* El contenedor del mapa, dentro de una caja: MapLibre le pone su propio
            `position: relative`, que pisaría el absoluto y lo dejaría sin alto. */}
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <Box ref={contenedor} role="img" aria-label={`Mapa del recorrido${actual ? `; va por ${actual.lugar}` : ''}`} sx={{ width: '100%', height: '100%' }} />
        </Box>
        {!listo && (
          <Typography sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#a9a3a7', fontSize: 13 }}>
            {error ? `No se pudo cargar el mapa. ${porCalles ? 'Las calles' : 'Las paradas'} están al lado.` : 'Cargando el mapa…'}
          </Typography>
        )}
        {listo && enCalle && (
          <Box role="status" sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, backgroundColor: 'rgba(7, 6, 8, .88)', border: `1px solid ${GRANATE_CLARO}`, color: '#fff', fontSize: 13 }}>
            <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: GRANATE_CLARO, animation: reducir ? 'none' : 'latido 1.6s ease-in-out infinite', '@keyframes latido': { '50%': { opacity: 0.3 } } }} />
            En directo · posición de las {enCalle.hora}
          </Box>
        )}
        {listo && !enCalle && (
          <Box sx={{ position: 'absolute', left: 12, bottom: { xs: 30, sm: 12 }, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', maxWidth: 'calc(100% - 24px)' }}>
            <Tooltip title={reproduciendo ? 'Pausa' : 'Ver el recorrido andando solo'}>
              <IconButton size="small" onClick={alternaPlay} aria-label={reproduciendo ? 'Pausar el recorrido' : 'Ver el recorrido andando solo'}
                sx={{ ...botonMapa, backgroundColor: GRANATE, borderColor: GRANATE_CLARO, '&:hover': { backgroundColor: MARCA.principalOscuro } }}>
                {reproduciendo ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Volver a empezar">
              <IconButton size="small" onClick={volverAEmpezar} aria-label="Volver a empezar el recorrido" sx={botonMapa}>
                <ReplayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <ToggleButtonGroup
              exclusive size="small" value={camara}
              onChange={(_, valor: Camara | null) => valor && setCamara(valor)}
              aria-label="Qué enseña la cámara"
              sx={{
                backgroundColor: 'rgba(7, 6, 8, .85)',
                '& .MuiToggleButton-root': { color: '#e4e2df', borderColor: 'rgba(204, 196, 201, .3)', textTransform: 'none', fontSize: 12.5, py: 0.5, px: 1.25 },
                '& .Mui-selected': { color: '#070608 !important', backgroundColor: `${GOLD} !important` },
              }}
            >
              <ToggleButton value="sigue">Seguir al trono</ToggleButton>
              <ToggleButton value="entero">Recorrido entero</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
      </Box>

      {/* La lista, del alto del mapa (en el móvil, debajo y más baja): solo la
          mueve el trono. Ni la rueda ni el dedo la desplazan; el scroll pasa a
          la página. */}
      <Box ref={caja} sx={{
        position: 'relative', overflowY: 'hidden',
        height: ALTO_LISTA, minHeight: ALTO_MINIMO_LISTA,
      }}>
      <Box component="ol" ref={lista} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {filas.map((fila, i) => {
          // Solo se enciende la calle por la que va el trono, en granate; las
          // ya pasadas se apagan como las que faltan. En el constructor, todas.
          const encendida = !enConstructor && i === alcanzada
          return (
          <Box
            component="li"
            // El itinerario repite lugares: la clave necesita el índice.
            key={`${fila.hora}-${fila.lugar}-${i}`}
            sx={{
              // Compacta (16-10-2026): con las calles son casi treinta filas, y a
              // 28 px la hora pesaba más que la calle.
              display: 'grid', gridTemplateColumns: sinHoras ? 'minmax(0, 1fr)' : '64px minmax(0, 1fr)', columnGap: 2, alignItems: 'center',
              py: 1.5, alignContent: 'center', borderBottom: '1px solid rgba(204, 196, 201, 0.14)',
              opacity: enConstructor || encendida ? 1 : 0.4, transition: 'opacity .5s ease',
              // Solo el texto va en burdeos, aclarado para que se lea sobre el fondo oscuro.
              '& > span': { transition: 'color .5s ease', ...(encendida && { color: BURDEOS_LEGIBLE }) },
            }}
          >
            {sinHoras ? null : fila.hora !== '' ? (
              <Typography component="span" sx={{ fontSize: { xs: 18, md: 20 }, fontWeight: 300, lineHeight: 1.1, color: '#e3d8bf', fontVariantNumeric: 'tabular-nums' }}>
                {fila.hora}
              </Typography>
            ) : (
              <Typography component="span" sx={{ fontSize: 12, lineHeight: 1.3, color: '#a9a3a7', letterSpacing: '.04em' }}>
                hora por confirmar
              </Typography>
            )}
            {/* Un cruce se pasa, no se recorre: más bajo y en cursiva. */}
            <Typography component="span" sx={{ fontSize: fila.cruce ? { xs: 13.5, md: 14 } : { xs: 15, md: 16 }, fontStyle: fila.cruce ? 'italic' : 'normal', lineHeight: 1.3, color: 'text.primary' }}>{fila.lugar}</Typography>
          </Box>
          )
        })}
      </Box>
      </Box>
    </Box>
    {sitios.length > 0 && <SitiosDeInteres sitios={sitios} pasados={enConstructor ? sitios.length : sitiosPasados} ahora={sitioAhora} />}
    </Box>
  )
}

/**
 * Los sitios de interés debajo del mapa, con su número (el mismo que en el
 * mapa), su hora aproximada y lo que pasa allí. El que el trono acaba de
 * alcanzar se marca en oro; los ya pasados se apagan.
 */
function SitiosDeInteres({ sitios, pasados, ahora }: { sitios: SitioDelRecorrido[]; pasados: number; ahora: number }) {
  return (
    <Box component="section" aria-label="Sitios de interés" sx={{ mt: 3 }}>
      <Typography component="h3" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a9a3a7', mb: 1.25 }}>
        Sitios de interés
      </Typography>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
        {sitios.map((sitio, i) => (
          <Box component="li" key={`${sitio.lugar}-${i}`} sx={{
            display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', columnGap: 1.25, alignItems: 'start',
            px: 1.5, py: 1.25, backgroundColor: 'rgba(26, 24, 27, 0.72)', borderRadius: '6px',
            border: '1px solid', borderColor: i === ahora ? GOLD : 'transparent',
            opacity: i < pasados && i !== ahora ? 0.55 : 1, transition: 'opacity .4s ease, border-color .4s ease',
          }}>
            <Box aria-hidden="true" sx={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${GOLD}`, color: GOLD, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{sitio.lugar}</Typography>
              <Typography sx={{ fontSize: 13, color: '#a9a3a7' }}>
                {[sitio.hora && `Hacia las ${sitio.hora}`, sitio.nota].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
