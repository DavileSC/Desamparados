import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import { useReducedMotion } from 'framer-motion'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as Mapa, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../mapa/trabajador'
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
/** El granate de la marca, aclarado para leerse sobre el fondo oscuro (5,4:1). */
const BURDEOS_LEGIBLE = '#e06a78'
/**
 * El alto del mapa y, en escritorio, también el de la lista de al lado. Con la
 * frase de encima y la cabecera, el bloque entero cabe en la pantalla con
 * holgura: no hace falta dejar el scroll clavado para ver el mapa entero. En
 * el móvil, mapa y lista van uno encima del otro y también caben juntos.
 */
const ALTO_MAPA = { xs: '40svh', md: 'min(760px, calc(100svh - 210px))' }
const ALTO_LISTA = { xs: '28svh', md: ALTO_MAPA.md }
const ALTO_MINIMO = { xs: 230, md: 380 }
const ALTO_MINIMO_LISTA = { xs: 170, md: ALTO_MINIMO.md }
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
 * se dibuja por las calles, el trono (un punto granate) llega a cada parada y
 * la lista de al lado se desliza a su par, con la calle por la que va en el
 * centro. Se puede pausar, volver a empezar y elegir si la cámara sigue al
 * trono o enseña el recorrido entero. Antes iba con el scroll de la página,
 * pero se pasaba en un momento: ahora el scroll solo mueve la página.
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
  /** La caja de la lista: solo se desliza con el trono, nunca a mano. */
  const caja = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLOListElement>(null)
  const mapa = useRef<Mapa | null>(null)
  const trono = useRef<Marker | null>(null)
  // Lo que cambia en cada fotograma va en refs: repintar el bloque 60 veces por
  // segundo sobraría. El estado solo cambia al alcanzar otra parada.
  const fraccion = useRef(enConstructor ? 1 : 0)
  const objetivo = useRef<Coordenada>(linea[0])
  const centro = useRef<Coordenada>(linea[0])
  const play = useRef<{ desde: number; inicio: number } | null>(null)
  const etiqueta = useRef<HTMLSpanElement | null>(null)
  /** El rótulo «Salida y entrada»: se aparta cuando el trono pasa por su lado. */
  const rotuloSalida = useRef<HTMLSpanElement | null>(null)
  const camaraActual = useRef(camara)
  camaraActual.current = camara
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
    // Con el trono cerca de la salida y el nombre de su calle al lado, los dos
    // rótulos se pisarían: el de la salida se aparta hasta que el trono se aleja.
    if (rotuloSalida.current) rotuloSalida.current.style.opacity = hasta >= 0 && metros(objetivo.current, linea[0]) < 70 ? '0' : '1'
  }, [linea, hechos, posiciones])

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
        if (camaraActual.current === 'entero') m.fitBounds(cajaDe(linea), { padding: MARGEN_ENTERO, pitch: 0, bearing: 0, duration: 0 })
      })
      medidor.observe(contenedor.current)

      const salida = document.createElement('div')
      salida.setAttribute('aria-hidden', 'true')
      salida.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20" style="display:block;margin:0 auto 3px;fill:${GOLD};filter:drop-shadow(0 0 6px rgba(222,199,43,.8))"><path d="M8.5 1h3v5h5v3h-5v10h-3V9h-5V6h5z"/></svg><span style="display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};background:rgba(7,6,8,.85);padding:3px 8px;border:1px solid rgba(222,199,43,.5);white-space:nowrap;transition:opacity .4s">${circular ? 'Salida y entrada' : 'Salida'}</span>`
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

  // Primera pintura: el trono en la salida (en el constructor, el recorrido entero).
  useEffect(() => {
    if (listo) pinta(enConstructor ? 1 : fraccion.current)
  }, [listo, enConstructor, pinta])

  // El reloj: el play y la cámara que sigue al trono sin dar saltos.
  useEffect(() => {
    if (!listo) return
    let marco = 0
    const paso = (ahora: number) => {
      const p = play.current
      if (p) {
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

  const actual = alcanzada >= 0 ? paradas[alcanzada] : null
  // Sin ninguna hora, «hora por confirmar» en cada calle recargaba la lista:
  // se dice una vez arriba y la lista va solo con las calles.
  const sinHoras = paradas.every((parada) => parada.hora === '')
  const botonMapa = {
    width: 34, height: 34, color: '#fff', backgroundColor: 'rgba(7, 6, 8, .85)', border: '1px solid rgba(204, 196, 201, .3)',
    '&:hover': { backgroundColor: 'rgba(7, 6, 8, .95)', borderColor: GOLD },
  }

  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto' }}>
      <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, color: '#e3d8bf', fontSize: 14 }}>
        <PlayArrowIcon sx={{ fontSize: 20, color: GOLD }} aria-hidden="true" />
        Dale al play para ver el recorrido andar por las calles.{sinHoras && ' Las horas, por confirmar.'}
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
        {paradas.map((parada, i) => {
          // Solo se enciende la calle por la que va el trono, en granate; las
          // ya pasadas se apagan como las que faltan. En el constructor, todas.
          const encendida = !enConstructor && i === alcanzada
          return (
          <Box
            component="li"
            // El itinerario repite lugares: la clave necesita el índice.
            key={`${parada.hora}-${parada.lugar}-${i}`}
            sx={{
              display: 'grid', gridTemplateColumns: sinHoras ? 'minmax(0, 1fr)' : '84px minmax(0, 1fr)', columnGap: 2, alignItems: 'center',
              py: 2.25, alignContent: 'center', borderBottom: '1px solid rgba(204, 196, 201, 0.14)',
              opacity: enConstructor || encendida ? 1 : 0.4, transition: 'opacity .5s ease',
              // Solo el texto va en burdeos, aclarado para que se lea sobre el fondo oscuro.
              '& > span': { transition: 'color .5s ease', ...(encendida && { color: BURDEOS_LEGIBLE }) },
            }}
          >
            {sinHoras ? null : parada.hora !== '' ? (
              <Typography component="span" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 300, lineHeight: 1.1, color: '#e3d8bf', fontVariantNumeric: 'tabular-nums' }}>
                {parada.hora}
              </Typography>
            ) : (
              <Typography component="span" sx={{ fontSize: 12, lineHeight: 1.3, color: '#a9a3a7', letterSpacing: '.04em' }}>
                hora por confirmar
              </Typography>
            )}
            <Typography component="span" sx={{ fontSize: { xs: 17, md: 19 }, lineHeight: 1.3, color: 'text.primary' }}>{parada.lugar}</Typography>
          </Box>
          )
        })}
      </Box>
      </Box>
    </Box>
    </Box>
  )
}
