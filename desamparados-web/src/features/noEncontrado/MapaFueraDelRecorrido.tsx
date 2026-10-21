import { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useReducedMotion } from 'framer-motion'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as Mapa } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../../components/mapa/trabajador'
import { ATRIBUCION, cargarBarrio, edificioDelTemplo, mapaVivo } from '../../components/mapa/barrio'
import { estiloDelMapa } from '../../components/mapa/estilo'
import { calleFueraDelRecorrido } from '../../components/mapa/desvio'
import { acumulados, tramoHasta } from '../../components/bloques/recorrido'
import { GOLD } from '../inicio/estilos'
import type { Coordenada } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

const ROSA = MARCA.principalClaro
const GRANATE_VIVO = MARCA.principalVivo
const CREMA = '#f3efe6'
/** Lo que tarda el trono en andar el recorrido, y la calle de fuera en marcarse. */
const RUTA_MS = 5200
const DESVIO_MS = 1400
/** Inclinado y algo girado, como el mapa del recorrido cuando sigue al trono. */
const CAMARA = { pitch: 42, bearing: -14 }

const comoLinea = (coordenadas: Coordenada[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coordenadas } })
const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

/** La placa de la calle de fuera: «Calle 404», con el nombre de verdad tachado debajo. */
function placa(calle: string): HTMLElement {
  const el = document.createElement('div')
  Object.assign(el.style, {
    background: CREMA, color: '#1b1c1a', borderRadius: '4px', padding: '6px 14px 4px', textAlign: 'center',
    boxShadow: '0 8px 18px rgba(0,0,0,.5)', fontFamily: 'inherit', opacity: '0', transition: 'opacity .5s .2s',
  })
  const linea = (texto: string, estilo: Partial<CSSStyleDeclaration>) => {
    const s = document.createElement('span')
    s.textContent = texto
    Object.assign(s.style, { display: 'block', ...estilo })
    el.appendChild(s)
  }
  linea('CALLE', { fontSize: '9.5px', fontWeight: '600', letterSpacing: '.16em' })
  linea('404', { fontSize: '24px', lineHeight: '1.05', fontWeight: '700' })
  linea(calle, { fontSize: '9.5px', color: '#6c666a', textDecoration: 'line-through', whiteSpace: 'nowrap' })
  return el
}

/**
 * El mapa de la página 404: el del recorrido, con el barrio y el templo, en
 * el que el trono anda el itinerario en oro y, al terminar, se marca en rosa
 * una calle que sale de él y no vuelve, con su placa «Calle 404». Es la broma
 * de la página: la dirección que se buscaba está fuera del recorrido.
 *
 * Lo que importa (que la página no existe y adónde ir) lo dice el texto de
 * al lado; el mapa lo acompaña. Con «reducir movimiento» sale ya dibujado y
 * quieto.
 */
export default function MapaFueraDelRecorrido({ linea, onSinMapa }: {
  linea: Coordenada[]
  /** Esta instalación no tiene mapa del barrio: la página se queda con el texto. */
  onSinMapa?: () => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  // Al día en un efecto, como en RecorridoEnMapa: escribir una referencia
  // mientras se pinta rompe el pintado concurrente de React.
  const avisarSinMapa = useRef(onSinMapa)
  useEffect(() => { avisarSinMapa.current = onSinMapa }, [onSinMapa])
  const reducir = useReducedMotion() ?? false
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    let creado: Mapa | null = null
    let medidor: ResizeObserver | null = null
    let fotograma = 0
    cargarBarrio().then((barrio) => {
      if (!vivo || !contenedor.current) return
      if (!barrio) {
        avisarSinMapa.current?.()
        return
      }
      const desvio = calleFueraDelRecorrido(barrio, linea)
      const todo = desvio ? [...linea, ...desvio.linea] : linea
      const caja = new maplibregl.LngLatBounds(todo[0], todo[0])
      todo.forEach((p) => caja.extend(p))
      const encuadrar = (m: Mapa) => {
        const ancho = contenedor.current?.clientWidth ?? 600
        const margen = ancho < 420 ? 24 : 56
        // Abajo, más: la placa cuelga debajo del final de la calle de fuera, y en el móvil se cortaba.
        m.fitBounds(caja, { padding: { top: margen, right: margen, left: margen, bottom: margen + (desvio ? 76 : 0) }, ...CAMARA, duration: 0 })
      }

      const m = new maplibregl.Map({
        container: contenedor.current,
        style: estiloDelMapa(barrio, edificioDelTemplo(barrio, linea[0])),
        interactive: false,
        attributionControl: false,
        bounds: caja,
      })
      creado = m
      m.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: ATRIBUCION }), 'bottom-right')
      // Como en el mapa del recorrido: la caja puede no tener aún su tamaño
      // final al crearse el mapa, y al cambiar se vuelve a encuadrar.
      medidor = new ResizeObserver(() => { m.resize(); encuadrar(m) })
      medidor.observe(contenedor.current)

      const trono = document.createElement('div')
      Object.assign(trono.style, {
        width: '16px', height: '16px', borderRadius: '50%', background: GRANATE_VIVO, border: `2.5px solid ${CREMA}`,
        boxShadow: `0 0 0 6px ${alfa(MARCA.principalVivo, .25)}`,
      })
      const marcaTrono = new maplibregl.Marker({ element: trono }).setLngLat(linea[0]).addTo(m)

      m.on('load', () => {
        if (!vivo || !mapaVivo(m)) return
        encuadrar(m)
        ;(m.getSource('rutaEntera') as GeoJSONSource).setData(comoLinea(linea))
        // La calle de fuera: en rosa y a trazos, encima de todo.
        m.addSource('desvio', { type: 'geojson', data: comoLinea([]) })
        m.addLayer({ id: 'desvio-brillo', type: 'line', source: 'desvio', layout: { 'line-cap': 'round' }, paint: { 'line-color': ROSA, 'line-width': 12, 'line-blur': 9, 'line-opacity': 0.35 } })
        m.addLayer({ id: 'desvio', type: 'line', source: 'desvio', layout: { 'line-cap': 'round' }, paint: { 'line-color': ROSA, 'line-width': 3.5, 'line-dasharray': [1.2, 1.4] } })

        let rotulos: HTMLElement[] = []
        if (desvio) {
          const final = desvio.linea[desvio.linea.length - 1]
          const punto = document.createElement('div')
          Object.assign(punto.style, { width: '14px', height: '14px', borderRadius: '50%', background: ROSA, opacity: '0', transition: 'opacity .4s' })
          new maplibregl.Marker({ element: punto }).setLngLat(final).addTo(m)
          // Debajo del punto: encima taparía la propia calle, que viene de arriba o de un lado.
          const cartel = placa(desvio.calle)
          new maplibregl.Marker({ element: cartel, anchor: 'top', offset: [0, 16] }).setLngLat(final).addTo(m)
          rotulos = [punto, cartel]
          if (!reducir) punto.animate([{ boxShadow: `0 0 0 0 ${ROSA}aa` }, { boxShadow: `0 0 0 14px ${ROSA}00` }], { duration: 2000, iterations: Infinity })
        }
        const acabar = () => {
          rotulos.forEach((r) => { r.style.opacity = '1' })
          if (!reducir) m.easeTo({ bearing: 12, duration: 26_000, easing: (x) => x })
        }

        const hechosRuta = acumulados(linea)
        const hechosDesvio = desvio ? acumulados(desvio.linea) : []
        if (reducir) {
          ;(m.getSource('rutaHecha') as GeoJSONSource).setData(comoLinea(linea))
          if (desvio) (m.getSource('desvio') as GeoJSONSource).setData(comoLinea(desvio.linea))
          marcaTrono.setLngLat(linea[linea.length - 1])
          acabar()
          return
        }
        const inicio = performance.now()
        const paso = (ahora: number) => {
          if (!vivo || !mapaVivo(m)) return
          const a = Math.min(1, (ahora - inicio) / RUTA_MS)
          const hecho = tramoHasta(linea, suave(a), hechosRuta)
          ;(m.getSource('rutaHecha') as GeoJSONSource).setData(comoLinea(hecho))
          marcaTrono.setLngLat(hecho[hecho.length - 1])
          if (a < 1) { fotograma = requestAnimationFrame(paso); return }
          const b = desvio ? Math.min(1, (ahora - inicio - RUTA_MS) / DESVIO_MS) : 1
          if (desvio && b > 0) (m.getSource('desvio') as GeoJSONSource).setData(comoLinea(tramoHasta(desvio.linea, suave(b), hechosDesvio)))
          if (b < 1) { fotograma = requestAnimationFrame(paso); return }
          acabar()
        }
        fotograma = requestAnimationFrame(paso)
      })
    }).catch(() => { if (vivo) setError(true) })
    return () => {
      vivo = false
      cancelAnimationFrame(fotograma)
      medidor?.disconnect()
      creado?.remove()
    }
  }, [linea, reducir])

  return (
    <Box
      sx={{
        position: 'relative', width: '100%', aspectRatio: { xs: '1.1 / 1', sm: '1.5 / 1', md: '1.05 / 1' },
        borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0b0a0c', border: '1px solid rgba(204, 196, 201, 0.12)',
        // El reconocimiento a OpenStreetMap, como en el mapa del recorrido.
        '& .maplibregl-ctrl.maplibregl-ctrl-attrib': { backgroundColor: 'rgba(7, 6, 8, .88)', padding: '3px 8px', borderTopLeftRadius: '4px' },
        '& .maplibregl-ctrl-attrib-inner': { color: '#e4e2df', fontSize: 11.5, lineHeight: 1.4 },
        '& .maplibregl-ctrl-attrib a': { color: '#e4e2df', textDecoration: 'underline', textUnderlineOffset: '2px' },
        '& .maplibregl-ctrl-attrib a:hover': { color: GOLD },
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0 }}>
        <Box ref={contenedor} role="img" aria-label="Mapa del recorrido de la salida, con una calle fuera de él marcada como 404" sx={{ width: '100%', height: '100%' }} />
      </Box>
      {error && (
        <Typography sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#a9a3a7', fontSize: 13 }}>
          No se pudo cargar el mapa.
        </Typography>
      )}
    </Box>
  )
}
