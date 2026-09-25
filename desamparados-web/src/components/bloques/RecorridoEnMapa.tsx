import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import SwipeVerticalIcon from '@mui/icons-material/SwipeVertical'
import { useReducedMotion } from 'framer-motion'
import maplibregl, { type GeoJSONSource, type Map as Mapa, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GOLD, GRANATE } from '../../features/inicio/estilos'
import { ATRIBUCION, cargarBarrio, centroDe, edificioDelTemplo, mapaVivo } from '../mapa/barrio'
import { estiloDelMapa } from '../mapa/estilo'
import { useModoEdicion } from './modoEdicion'
import { anchoMaximo } from './presentacion'
import { acumulados, metros, paradaAlcanzada, posicionesEnRuta, tramoHasta } from './recorrido'
import type { BloqueItinerario, Coordenada, RecorridoEnMapa as Recorrido } from '../../lib/api/contenido'

/** Lo que tarda el play en andar el recorrido entero: despacio, para verlo. */
const DURACION_PLAY_MS = 60_000
/** La cámara que sigue al trono: cerca e inclinada, con los edificios en relieve. */
const CAMARA_CERCA = { zoom: 16.6, pitch: 52, bearing: -12 }
const GRANATE_CLARO = '#fc858a'
/** Lo que mide cada calle de la lista: algo más que un giro de la rueda del ratón (100 px), para que un giro avance una parada y nunca dos. */
const ALTO_CALLE = { xs: 110, md: 110 }
/** Lo que se ve de la lista mientras el mapa está quieto: el alto del mapa, o en el móvil lo que queda de pantalla debajo. */
const VISTA_LISTA = { xs: 'max(0px, 54svh - 88px)', md: 'max(420px, 100svh - 128px)' }

/**
 * El alto de cada calle para que, con `n` calles, la lista mida lo que se ve
 * de ella más un gesto por calle: n · alto = vista + (n − 1) · ALTO_CALLE.
 */
const altoDeCalleCon = (n: number) => ({
  xs: `calc((${ALTO_CALLE.xs * Math.max(0, n - 1)}px + ${VISTA_LISTA.xs}) / ${Math.max(1, n)})`,
  md: `calc((${ALTO_CALLE.md * Math.max(0, n - 1)}px + ${VISTA_LISTA.md}) / ${Math.max(1, n)})`,
})

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
 * Según se baja por las paradas, la línea del recorrido se dibuja por las
 * calles y el trono (un punto granate) llega a cada una; si se sube, vuelve
 * atrás. El recorrido empieza justo cuando el mapa se queda quieto y acaba
 * justo cuando se suelta: no hay tramo de scroll en que el mapa no haga nada.
 *
 * Quien lo ve puede darle al play y verlo andar solo, despacio (un minuto el
 * recorrido entero), volver a empezar, y elegir si la cámara sigue al trono o
 * enseña el recorrido entero. Si baja mientras se reproduce, el play se para y
 * el mapa vuelve a ir con el scroll. Un texto encima lo explica.
 *
 * Con «reducir movimiento» la cámara empieza enseñando el recorrido entero y
 * no se desliza. En la vista en vivo del constructor sale entero y dibujado.
 */
export default function RecorridoEnMapa({ bloque }: { bloque: BloqueItinerario & { recorrido: Recorrido } }) {
  const { paradas } = bloque
  const linea = bloque.recorrido.linea
  const reducir = useReducedMotion() ?? false
  const enConstructor = useModoEdicion() !== null

  const [camara, setCamara] = useState<Camara>(reducir || enConstructor ? 'entero' : 'sigue')
  const [reproduciendo, setReproduciendo] = useState(false)
  const [alcanzada, setAlcanzada] = useState(enConstructor ? paradas.length - 1 : -1)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState(false)

  const hechos = useMemo(() => acumulados(linea), [linea])
  const posiciones = useMemo(() => posicionesEnRuta(paradas), [paradas])
  const circular = linea.length > 1 && metros(linea[0], linea[linea.length - 1]) < 40

  const contenedor = useRef<HTMLDivElement>(null)
  const sitio = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLOListElement>(null)
  const mapa = useRef<Mapa | null>(null)
  const trono = useRef<Marker | null>(null)
  // Lo que cambia en cada fotograma va en refs: repintar el bloque 60 veces por
  // segundo sobraría. El estado solo cambia al alcanzar otra parada.
  const fraccion = useRef(enConstructor ? 1 : 0)
  const objetivo = useRef<Coordenada>(linea[0])
  const centro = useRef<Coordenada>(linea[0])
  const play = useRef<{ desde: number; inicio: number } | null>(null)
  /** La parada a la que va el trono (su fracción): la marca el scroll, y el reloj lo hace andar hasta ella. */
  const destino = useRef(enConstructor ? 1 : 0)
  const etiqueta = useRef<HTMLSpanElement | null>(null)
  /** El rótulo «Salida y entrada»: se aparta cuando el trono pasa por su lado. */
  const rotuloSalida = useRef<HTMLSpanElement | null>(null)
  const camaraActual = useRef(camara)
  camaraActual.current = camara

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
    // Con el trono cerca de la salida y el nombre de su calle al lado, los dos
    // rótulos se pisarían: el de la salida se aparta hasta que el trono se aleja.
    if (rotuloSalida.current) rotuloSalida.current.style.opacity = hasta >= 0 && metros(objetivo.current, linea[0]) < 70 ? '0' : '1'
  }, [linea, hechos, posiciones])

  /**
   * Cuánto del recorrido corresponde al scroll. El 0 es el momento en que el
   * mapa se queda quieto y la lista empieza a pasar a su lado (o, en el móvil,
   * por debajo); el 1, cuando la lista llega al final del mapa (o de la
   * pantalla). Entre medias, cada parada se alcanza cuando pasa por la altura
   * proporcional de la lista, y el trono anda hasta ella y se para.
   */
  const destinoDelScroll = useCallback((): number => {
    const caja = sitio.current?.getBoundingClientRect()
    const ol = lista.current
    if (!caja || !ol) return 0
    const cajaLista = ol.getBoundingClientRect()
    const alLado = cajaLista.left >= caja.right - 1
    const inicio = alLado ? caja.top : caja.bottom + 16
    const fin = alLado ? caja.bottom : window.innerHeight
    const recorre = cajaLista.height - (fin - inicio)
    const p = recorre <= 0 ? (cajaLista.top <= inicio ? 1 : 0) : Math.min(1, Math.max(0, (inicio - cajaLista.top) / recorre))
    const filas = Array.from(ol.children) as HTMLElement[]
    if (filas.length < 2) return p
    const centros = filas.map((f) => f.offsetTop + f.offsetHeight / 2)
    const v = centros[0] + p * (centros[centros.length - 1] - centros[0])
    // De parada en parada: el scroll no deja el trono entre dos, lo lleva a la
    // parada más cercana a esa altura y el reloj lo hace andar hasta ella.
    let i = 0
    centros.forEach((c, j) => { if (Math.abs(c - v) < Math.abs(centros[i] - v)) i = j })
    return posiciones[i]
  }, [posiciones])

  // El mapa: se crea una vez, cuando llegan los datos del barrio.
  useEffect(() => {
    let vivo = true
    let creado: Mapa | null = null
    let medidor: ResizeObserver | null = null
    cargarBarrio().then((barrio) => {
      if (!vivo || !contenedor.current) return
      // La iglesia de la que sale y a la que vuelve: se destaca, y la cruz va encima.
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
        if (camaraActual.current === 'entero') m.fitBounds(cajaDe(linea), { padding: 48, pitch: 0, bearing: 0, duration: 0 })
      })
      medidor.observe(contenedor.current)

      const salida = document.createElement('div')
      salida.setAttribute('aria-hidden', 'true')
      salida.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20" style="display:block;margin:0 auto 3px;fill:${GOLD};filter:drop-shadow(0 0 6px rgba(222,199,43,.8))"><path d="M8.5 1h3v5h5v3h-5v10h-3V9h-5V6h5z"/></svg><span style="display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};background:rgba(16,14,17,.85);padding:3px 8px;border:1px solid rgba(222,199,43,.5);white-space:nowrap;transition:opacity .4s">${circular ? 'Salida y entrada' : 'Salida'}</span>`
      // Un poco por encima del punto: al salir y al volver, el trono está
      // justo ahí con el nombre de su calle al lado, y no deben pisarse.
      new maplibregl.Marker({ element: salida, anchor: 'bottom', offset: [0, -16] }).setLngLat(templo ? centroDe(templo) : linea[0]).addTo(m)
      rotuloSalida.current = salida.querySelector('span')

      const punto = document.createElement('div')
      punto.setAttribute('aria-hidden', 'true')
      Object.assign(punto.style, {
        width: '18px', height: '18px', borderRadius: '50%', background: GRANATE, border: `2px solid ${GRANATE_CLARO}`,
        boxShadow: '0 0 0 7px rgba(252,133,138,.22), 0 0 18px rgba(252,133,138,.5)',
      })
      // La calle por la que va, pequeña y al lado del trono: no tapa el mapa.
      const nombre = document.createElement('span')
      Object.assign(nombre.style, {
        position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap',
        maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 7px', fontSize: '11.5px',
        color: '#fff', background: 'rgba(16,14,17,.82)', borderLeft: `2px solid ${GOLD}`, fontFamily: 'inherit',
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
    const parada = alcanzada >= 0 ? paradas[alcanzada] : null
    el.textContent = parada ? `${parada.hora ? `${parada.hora} · ` : ''}${parada.lugar}` : ''
    el.style.display = parada ? 'block' : 'none'
  }, [alcanzada, paradas, listo])

  // Las paradas en el mapa: encendidas hasta la alcanzada.
  useEffect(() => {
    if (!listo || !mapaVivo(mapa.current)) return
    const hechas = enConstructor ? paradas.length - 1 : alcanzada
    ;(mapa.current?.getSource('paradas') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: posiciones.map((f, i) => ({
        type: 'Feature', properties: { hecha: i <= hechas },
        geometry: { type: 'Point', coordinates: tramoHasta(linea, f, hechos).at(-1)! },
      })),
    })
  }, [listo, alcanzada, posiciones, linea, hechos, paradas.length, enConstructor])

  // Primera pintura y cada vez que se baja o se sube.
  useEffect(() => {
    if (!listo) return
    if (enConstructor) { pinta(1); return }
    destino.current = destinoDelScroll()
    pinta(destino.current)
    const alScroll = () => {
      // Bajar mientras se reproduce devuelve el mapa al scroll.
      if (play.current) { play.current = null; setReproduciendo(false) }
      destino.current = destinoDelScroll()
    }
    window.addEventListener('scroll', alScroll, { passive: true })
    window.addEventListener('resize', alScroll)
    return () => {
      window.removeEventListener('scroll', alScroll)
      window.removeEventListener('resize', alScroll)
    }
  }, [listo, enConstructor, pinta, destinoDelScroll])

  // El reloj: el play y la cámara que sigue al trono sin dar saltos.
  useEffect(() => {
    if (!listo) return
    let marco = 0
    const paso = (ahora: number) => {
      const p = play.current
      if (p) {
        const f = Math.min(1, p.desde + (ahora - p.inicio) / DURACION_PLAY_MS)
        pinta(f)
        if (f >= 1) { play.current = null; destino.current = 1; setReproduciendo(false) }
      } else {
        const d = destino.current, f = fraccion.current
        // Hasta la parada, frenando al llegar; con «reducir movimiento», de golpe.
        if (Math.abs(d - f) > 1e-5) pinta(reducir || Math.abs(d - f) < 0.001 ? d : f + (d - f) * 0.06)
      }
      const m = mapa.current
      // Mientras la cámara cambia de plano (acercarse al trono, alejarse al
      // recorrido entero) no se la mueve: un salto la cortaría a medias y se
      // quedaría inclinada a medio zoom. Al acabar, sigue al trono desde ahí.
      if (m && mapaVivo(m) && camaraActual.current === 'sigue' && !m.isEasing()) {
        const [ox, oy] = objetivo.current
        const [cx, cy] = centro.current
        centro.current = reducir ? [ox, oy] : [cx + (ox - cx) * 0.12, cy + (oy - cy) * 0.12]
        if (Math.abs(centro.current[0] - cx) > 1e-9 || Math.abs(centro.current[1] - cy) > 1e-9) m.jumpTo({ center: centro.current })
      }
      marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
  }, [listo, pinta, reducir])

  // Cambio de cámara: al trono, de cerca, o el recorrido entero desde arriba.
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m || !mapaVivo(m)) return
    const duracion = reducir ? 0 : 1200
    if (camara === 'entero') {
      m.fitBounds(cajaDe(linea), { padding: 48, pitch: 0, bearing: 0, duration: duracion })
    } else {
      centro.current = objetivo.current
      m.easeTo({ center: objetivo.current, ...CAMARA_CERCA, duration: duracion })
    }
  }, [camara, listo, linea, reducir])

  const alternaPlay = () => {
    if (play.current) { play.current = null; destino.current = fraccion.current; setReproduciendo(false); return }
    const desde = fraccion.current >= 0.999 ? 0 : fraccion.current
    play.current = { desde, inicio: performance.now() }
    setReproduciendo(true)
  }

  /**
   * Volver a empezar: de cero, no marcha atrás. El trono aparece en la salida,
   * la línea se borra, la cámara salta al principio y la página vuelve de golpe
   * al comienzo de la lista (un desplazamiento suave haría pasar el scroll por
   * todas las paradas y el trono desandaría el camino).
   */
  const volverAEmpezar = () => {
    play.current = null
    setReproduciendo(false)
    destino.current = 0
    pinta(0)
    centro.current = linea[0]
    if (camaraActual.current === 'sigue') mapa.current?.jumpTo({ center: linea[0] })
    const caja = sitio.current?.getBoundingClientRect()
    const cajaLista = lista.current?.getBoundingClientRect()
    if (!caja || !cajaLista) return
    const alLado = cajaLista.left >= caja.right - 1
    const inicio = alLado ? caja.top : caja.bottom + 16
    const sobra = cajaLista.top - inicio
    if (sobra < -1) window.scrollTo({ top: window.scrollY + sobra, behavior: 'instant' })
  }

  const actual = alcanzada >= 0 ? paradas[alcanzada] : null
  const altoDeCalle = altoDeCalleCon(paradas.length)
  const botonMapa = {
    width: 34, height: 34, color: '#fff', backgroundColor: 'rgba(16, 14, 17, .85)', border: '1px solid rgba(204, 196, 201, .3)',
    '&:hover': { backgroundColor: 'rgba(16, 14, 17, .95)', borderColor: GOLD },
  }

  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto' }}>
      {/* Cómo se usa: va encima del mapa y de la lista, no dentro de la lista,
          para que el recorrido empiece justo cuando el mapa se queda quieto. */}
      <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, color: '#e3d8bf', fontSize: 14 }}>
        <SwipeVerticalIcon sx={{ fontSize: 20, color: GOLD }} aria-hidden="true" />
        Baja por las calles para seguir el recorrido en el mapa, o dale al play para verlo andar solo.
      </Typography>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.45fr) minmax(0, 1fr)' },
        columnGap: { md: 7 },
      }}
    >
      <Box
        ref={sitio}
        sx={{
          position: 'sticky', top: { xs: 72, md: 104 }, alignSelf: 'start', zIndex: 3,
          height: { xs: '46svh', md: 'calc(100svh - 128px)' }, minHeight: { xs: 300, md: 420 },
          mb: { xs: 2, md: 0 }, overflow: 'hidden', border: '1px solid rgba(204, 196, 201, 0.14)', backgroundColor: '#1a181b',
          // El reconocimiento a OpenStreetMap que pide su licencia (ODbL): siempre
          // a la vista, legible sobre el mapa oscuro y con el enlace a sus
          // condiciones. No se pliega en un botón «i». Con las dos clases, para
          // ganar a la hoja de MapLibre, que le pone un fondo blanco a medias.
          '& .maplibregl-ctrl.maplibregl-ctrl-attrib': { backgroundColor: 'rgba(16, 14, 17, .88)', padding: '3px 8px', borderTopLeftRadius: '4px' },
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
            {error ? 'No se pudo cargar el mapa. Las paradas están al lado.' : 'Cargando el mapa…'}
          </Typography>
        )}
        {listo && (
          <Box sx={{ position: 'absolute', left: 12, bottom: { xs: 30, sm: 12 }, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', maxWidth: 'calc(100% - 24px)' }}>
            <Tooltip title={reproduciendo ? 'Pausa' : 'Ver el recorrido andando solo'}>
              <IconButton size="small" onClick={alternaPlay} aria-label={reproduciendo ? 'Pausar el recorrido' : 'Ver el recorrido andando solo'}
                sx={{ ...botonMapa, backgroundColor: GRANATE, borderColor: GRANATE_CLARO, '&:hover': { backgroundColor: '#81262e' } }}>
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
                backgroundColor: 'rgba(16, 14, 17, .85)',
                '& .MuiToggleButton-root': { color: '#e4e2df', borderColor: 'rgba(204, 196, 201, .3)', textTransform: 'none', fontSize: 12.5, py: 0.5, px: 1.25 },
                '& .Mui-selected': { color: '#100e11 !important', backgroundColor: `${GOLD} !important` },
              }}
            >
              <ToggleButton value="sigue">Seguir al trono</ToggleButton>
              <ToggleButton value="entero">Recorrido entero</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
      </Box>

      {/* Una calle por gesto, y sin hueco al final. El recorrido va de la lista
          arriba del todo junto al mapa a la lista acabando justo al pie del
          mapa (en el móvil, de la pantalla), así que da para lo que mide la
          lista menos el mapa. Las calles se estiran lo justo para que eso sea
          un giro de rueda y algo (ALTO_CALLE) por cada calle: la última,
          «Regreso al templo», llega al pie del mapa y ahí se acaba. */}
      <Box component="ol" ref={lista} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {paradas.map((parada, i) => (
          <Box
            component="li"
            // El itinerario repite lugares: la clave necesita el índice.
            key={`${parada.hora}-${parada.lugar}-${i}`}
            sx={{
              display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', columnGap: 2, alignItems: 'baseline',
              minHeight: altoDeCalle, boxSizing: 'border-box', alignContent: 'center', borderBottom: '1px solid rgba(204, 196, 201, 0.14)',
              opacity: i <= alcanzada ? 1 : 0.4, transition: 'opacity .5s ease',
            }}
          >
            {parada.hora !== '' ? (
              <Typography component="span" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 300, lineHeight: 1.1, color: '#e3d8bf', fontVariantNumeric: 'tabular-nums' }}>
                {parada.hora}
              </Typography>
            ) : (
              <Typography component="span" sx={{ fontSize: 12, lineHeight: 1.3, color: '#a9a3a7', letterSpacing: '.04em' }}>
                hora por confirmar
              </Typography>
            )}
            <Typography component="span" sx={{ fontSize: { xs: 17, md: 19 }, color: 'text.primary' }}>{parada.lugar}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
    </Box>
  )
}
