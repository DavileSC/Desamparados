/**
 * El editor del recorrido sobre el mapa del barrio, como el de Google My Maps
 * (18-10-2026): se dibuja por puntos (una pulsación en cada esquina, en el
 * orden en que anda la procesión) o a mano alzada, y lo dibujado se retoca:
 * las esquinas se arrastran, entre dos se mete otra pulsando el punto pequeño
 * de en medio y las que sobran se quitan. Pegada a las calles, la línea va por
 * la calzada aunque el trazo se tuerza. Después se sitúa cada parada pulsando
 * en su sitio.
 *
 * El dibujo lo lleva Terra Draw sobre MapLibre. Todo se carga aparte (ver
 * `listas.tsx`), solo al abrir un itinerario.
 */
import { useEffect, useRef, useState } from 'react'
import { Box, Button, FormControlLabel, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import UndoIcon from '@mui/icons-material/Undo'
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined'
import LoopIcon from '@mui/icons-material/Loop'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as Mapa, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TerraDraw, TerraDrawFreehandLineStringMode, TerraDrawLineStringMode, TerraDrawSelectMode, type HexColor } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import '../../../../components/mapa/trabajador'
import topes from '../../../../../../shared/topes-contenido.json'
import { ATRIBUCION, cargarBarrio, edificioDelTemplo, hayWebGL, mapaVivo } from '../../../../components/mapa/barrio'
import { estiloDelMapa } from '../../../../components/mapa/estilo'
import { construirGrafo, lineaDelRecorrido, rectosTrasCambio, simplificar, type Grafo } from '../../../../components/mapa/grafo'
import { fraccionMasCercana, metros, posicionesEnRuta, puntoEn } from '../../../../components/bloques/recorrido'
import type { Coordenada, ParadaRecorrido, RecorridoEnMapa } from '../../../../lib/api/contenido'
import { MARCA } from '../../../../theme/marca'

const VACIO: RecorridoEnMapa = { esquinas: [], linea: [], pegado: true }
const redondea = (c: Coordenada): Coordenada => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6]
const clave = (esquinas: Coordenada[]) => JSON.stringify(esquinas)
const sinNada = { type: 'FeatureCollection' as const, features: [] }
/** Fija: un `[]` nuevo en cada pintado repintaría el mapa cada vez. */
const SIN_REFERENCIA: Coordenada[] = []

/** Lo que se dibuja, en crema fino; lo que se guarda (la línea pegada a las calles) va debajo, en oro. */
const CREMA = '#e3d8bf' as HexColor
const FONDO = '#0b0a0c' as HexColor
const ORO = MARCA.acento as HexColor
/**
 * Un identificador para Terra Draw, que los quiere UUID v4. `randomUUID` solo
 * existe en https o en localhost: el CMS abierto por la IP de la red local no lo tiene.
 */
const nuevoId = (): string => crypto.randomUUID?.()
  ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((c === 'x' ? 0 : 8) + Math.floor(Math.random() * (c === 'x' ? 16 : 4))).toString(16))
/** Los metros de temblor que se le quitan al trazo a mano alzada. */
const TEMBLOR_M = 5
/** Los píxeles a los que se acierta una esquina o un tramo con el dedo. */
const AL_DEDO = 26

interface Props {
  recorrido: RecorridoEnMapa | undefined
  paradas: ParadaRecorrido[]
  onRecorrido: (recorrido: RecorridoEnMapa) => void
  onParadas: (paradas: ParadaRecorrido[]) => void
  /** La línea del otro recorrido (el habitual o el alternativo), a trazos, para dibujar este encima. */
  referencia?: Coordenada[]
}

/**
 * Qué hace el ratón o el dedo en el mapa. «Quitar» y «Rectos» son retoques:
 * pulsar una esquina la quita; pulsar un tramo lo pone recto o por las calles.
 */
type Modo = 'puntos' | 'mano' | 'retocar' | 'quitar' | 'rectos' | 'situar'

const AYUDA: Record<Modo, string> = {
  puntos: 'Pulsa en cada esquina, en el orden en que anda la procesión: de la salida a la entrada. Para terminar, pulsa otra vez el último punto. El trazo nuevo sustituye al que hubiera («Deshacer» lo recupera).',
  mano: 'Arrastra el dedo o el ratón por las calles, de la salida a la entrada, sin soltar. Al soltar se le quita el temblor y queda en esquinas que se pueden retocar.',
  retocar: 'Arrastra una esquina para moverla. Para meter otra entre dos, pulsa el punto pequeño que hay en medio y arrástralo a su sitio. Con la rueda del ratón o dos dedos te acercas.',
  quitar: 'Pulsa las esquinas que sobren. Para acabar, vuelve a «Retocar».',
  rectos: 'Pulsa un tramo que haga zigzag por el mapa (un cruce) y irá recto de esquina a esquina; púlsalo otra vez y volverá a ir por las calles.',
  situar: 'Elige la parada y pulsa en su sitio del recorrido: se engancha a la línea. Las que no sitúes se reparten solas entre las demás.',
}

/** Lo que se lee en el sitio del mapa cuando la instalación no tiene barrio. */
const SIN_BARRIO = 'Esta instalación no tiene mapa del barrio, así que el recorrido no se puede dibujar. '
  + 'Las paradas y sus horas se editan igual, y la web las enseña en lista.'

/** Distancia en píxeles de un punto a un tramo. */
function distanciaAlTramo(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/** El rótulo de la salida o la entrada, al lado de su punto. */
function hito(color: string): Marker {
  const el = document.createElement('div')
  Object.assign(el.style, {
    pointerEvents: 'none', font: '600 12px/1 sans-serif', color: '#f3ece6', background: 'rgba(11, 10, 12, 0.88)',
    padding: '5px 8px', borderRadius: '6px', border: `1px solid ${color}`, whiteSpace: 'nowrap',
  })
  return new maplibregl.Marker({ element: el, anchor: 'left', offset: [14, 0] })
}

export default function EditorDeRecorrido({ recorrido, paradas, onRecorrido, onParadas, referencia = SIN_REFERENCIA }: Props) {
  const actual = recorrido ?? VACIO
  const [modo, setModo] = useState<Modo>(actual.linea.length >= 2 ? 'retocar' : 'puntos')
  const [parada, setParada] = useState(0)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(hayWebGL() ? null : 'Este navegador no puede pintar el mapa (no tiene WebGL).')
  /** Los estados de antes de cada cambio, para «Deshacer». */
  const [historia, setHistoria] = useState<RecorridoEnMapa[]>([])

  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<Mapa | null>(null)
  const dibujo = useRef<TerraDraw | null>(null)
  const grafo = useRef<Grafo | null>(null)
  /** El trazo que lleva Terra Draw (uno solo) y sus esquinas: si lo guardado cambia por otro lado, se vuelve a poner. */
  const idTrazo = useRef<string | number | null>(null)
  const enDibujo = useRef<string>('')
  const marcas = useRef<Marker[]>([])
  const hitos = useRef<{ salida: Marker; entrada: Marker } | null>(null)
  // Los avisos del mapa y de Terra Draw se enganchan una vez: leen siempre lo último por aquí.
  const ultimo = useRef({ actual, modo, parada, paradas, onRecorrido, onParadas })
  ultimo.current = { actual, modo, parada, paradas, onRecorrido, onParadas }

  /**
   * Guarda unas esquinas nuevas y la línea que sale de ellas. Las calles, la
   * salida y la entrada se quedan: con el trazo retocado, la Junta vuelve a
   * sacar las calles si hace falta (lo dice el apartado de las calles).
   */
  const guardar = (esquinas: Coordenada[], cambios: { pegado?: boolean; rectos?: number[] } = {}) => {
    const antes = ultimo.current.actual
    const pegado = cambios.pegado ?? antes.pegado
    // Un tramo recto que ya no existe (se quitó su esquina) no se guarda.
    const rectos = (cambios.rectos ?? rectosTrasCambio(antes.esquinas, esquinas, antes.rectos ?? [])).filter((i) => i < esquinas.length - 1)
    const linea = lineaDelRecorrido(esquinas, pegado, grafo.current, rectos)
    setHistoria((h) => [...h.slice(-49), antes])
    enDibujo.current = clave(esquinas)
    ultimo.current.onRecorrido({ ...antes, esquinas, rectos, linea, pegado })
  }

  /** Deja en el dibujo un único trazo con esas esquinas. */
  const ponerTrazo = (esquinas: Coordenada[]) => {
    const td = dibujo.current
    if (!td) return
    td.clear()
    idTrazo.current = null
    enDibujo.current = clave(esquinas)
    if (esquinas.length < 2) return
    const id = nuevoId()
    const [resultado] = td.addFeatures([{ id, type: 'Feature', geometry: { type: 'LineString', coordinates: esquinas }, properties: { mode: 'linestring' } }])
    if (!resultado?.valid) return
    idTrazo.current = id
    // Recién terminado un trazo, Terra Draw sigue en el modo de dibujar: elige el trazo al pasar a retocar.
    if (td.getMode() === 'select') td.selectFeature(id)
  }

  const esquinasDelTrazo = (): Coordenada[] | null => {
    const td = dibujo.current
    if (!td || idTrazo.current === null) return null
    const f = td.getSnapshotFeature(idTrazo.current)
    return f && f.geometry.type === 'LineString' ? (f.geometry.coordinates as Coordenada[]).map(redondea) : null
  }

  useEffect(() => {
    if (error) return
    let vivo = true
    let creado: Mapa | null = null
    let medidor: ResizeObserver | null = null
    let aplazado: number | undefined
    let fotograma = 0
    cargarBarrio().then((barrio) => {
      if (!vivo || !contenedor.current) return
      if (!barrio) {
        // Una instalación sin instalacion/mapas/barrio.json: no hay calles
        // sobre las que dibujar. Lo demás del bloque sigue funcionando.
        setError(SIN_BARRIO)
        return
      }
      grafo.current = construirGrafo(barrio)
      const inicio = ultimo.current.actual.linea[0]
      const m = new maplibregl.Map({
        container: contenedor.current,
        style: estiloDelMapa(barrio, inicio ? edificioDelTemplo(barrio, inicio) : null),
        center: inicio ?? [(barrio.caja[0] + barrio.caja[2]) / 2, (barrio.caja[1] + barrio.caja[3]) / 2],
        zoom: 15.4,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      })
      creado = m
      mapa.current = m
      m.touchZoomRotate.disableRotation()
      // El mapa se mide al crearse, y a veces es antes de que su caja tenga el
      // tamaño final (la hoja de estilos de MapLibre llega con él): se vuelve a
      // medir cada vez que la caja cambia.
      medidor = new ResizeObserver(() => m.resize())
      medidor.observe(contenedor.current)
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: ATRIBUCION }), 'bottom-right')
      m.on('load', () => {
        if (!vivo) return
        // Para editar, plano: los edificios en relieve taparían las calles.
        m.setPaintProperty('edificios', 'fill-extrusion-height', 0)
        // Las esquinas para quitar y los tramos que van rectos, solo mientras se tocan.
        m.addSource('editor-esquinas', { type: 'geojson', data: sinNada })
        m.addSource('editor-rectos', { type: 'geojson', data: sinNada })
        m.addLayer({ id: 'editor-rectos', type: 'line', source: 'editor-rectos', paint: { 'line-color': CREMA, 'line-width': 3, 'line-dasharray': [1, 1.4] } })
        m.addLayer({ id: 'editor-esquinas', type: 'circle', source: 'editor-esquinas', paint: { 'circle-radius': 9, 'circle-color': MARCA.principalClaro, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } })
        const linea = ultimo.current.actual.linea
        if (linea.length >= 2) {
          const caja = new maplibregl.LngLatBounds(linea[0], linea[0])
          linea.forEach((p) => caja.extend(p))
          m.fitBounds(caja, { padding: 48, duration: 0 })
        }
        hitos.current = { salida: hito(MARCA.principalClaro), entrada: hito(ORO) }

        const trazo = { lineStringColor: CREMA, lineStringWidth: 2, closingPointColor: ORO, closingPointWidth: 8, closingPointOutlineColor: FONDO, closingPointOutlineWidth: 2 }
        const td = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map: m }),
          modes: [
            new TerraDrawLineStringMode({ styles: trazo, pointerDistance: AL_DEDO }),
            new TerraDrawFreehandLineStringMode({ styles: { ...trazo, lineStringWidth: 3 }, drawInteraction: 'click-move-or-drag', minDistance: 8 }),
            new TerraDrawSelectMode({
              // El trazo se queda elegido: es el único y se retoca sin tener que pulsarlo antes.
              allowManualDeselection: false,
              keyEvents: { deselect: null, delete: null, rotate: null, scale: null },
              pointerDistance: AL_DEDO,
              flags: { linestring: { feature: { draggable: false, coordinates: { midpoints: true, draggable: true, deletable: true } } } },
              styles: {
                selectedLineStringColor: CREMA, selectedLineStringWidth: 2,
                selectionPointColor: ORO, selectionPointWidth: 8, selectionPointOutlineColor: FONDO, selectionPointOutlineWidth: 2,
                midPointColor: CREMA, midPointWidth: 5, midPointOutlineColor: FONDO, midPointOutlineWidth: 1.5,
              },
            }),
          ],
        })
        td.start()
        dibujo.current = td

        // Un trazo nuevo terminado: sustituye al que hubiera y pasa a retocarse.
        td.on('finish', (id, contexto) => {
          if (contexto.action !== 'draw') return
          const f = td.getSnapshotFeature(id)
          if (!f || f.geometry.type !== 'LineString') return
          let esquinas = (f.geometry.coordinates as Coordenada[]).map(redondea)
          if (contexto.mode === 'freehand-linestring') esquinas = simplificar(esquinas, TEMBLOR_M)
          esquinas = esquinas.slice(0, topes.puntosPorTrazado)
          // Aplazado: Terra Draw aún está cerrando el trazo cuando avisa.
          window.setTimeout(() => {
            setModo('retocar')
            ponerTrazo(esquinas)
            guardar(esquinas, { rectos: [] })
          })
        })
        // Mientras se arrastra, la línea de oro sigue al dedo; se guarda al parar.
        td.on('change', (ids) => {
          if (idTrazo.current === null || !ids.includes(idTrazo.current)) return
          cancelAnimationFrame(fotograma)
          fotograma = requestAnimationFrame(() => {
            const esquinas = esquinasDelTrazo()
            if (!esquinas || clave(esquinas) === enDibujo.current || !mapaVivo(m)) return
            const { pegado, rectos } = ultimo.current.actual
            const vistaPrevia = lineaDelRecorrido(esquinas, pegado, grafo.current, rectosTrasCambio(ultimo.current.actual.esquinas, esquinas, rectos ?? []))
            ;(m.getSource('rutaHecha') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: vistaPrevia } })
            window.clearTimeout(aplazado)
            aplazado = window.setTimeout(() => {
              const ahora = esquinasDelTrazo()
              if (ahora && clave(ahora) !== enDibujo.current) guardar(ahora)
            }, 250)
          })
        })

        ponerTrazo(ultimo.current.actual.esquinas)
        setListo(true)
      })
      m.on('click', (e) => {
        const u = ultimo.current
        const esquinas = u.actual.esquinas
        if (u.modo === 'quitar') {
          let cual = -1, menor = AL_DEDO
          esquinas.forEach((p, i) => {
            const d = Math.hypot(m.project(p).x - e.point.x, m.project(p).y - e.point.y)
            if (d < menor) { menor = d; cual = i }
          })
          if (cual === -1 || esquinas.length <= 2) return
          const nuevas = esquinas.filter((_, i) => i !== cual)
          ponerTrazo(nuevas)
          guardar(nuevas)
          return
        }
        if (u.modo === 'rectos') {
          let cual = -1, menor = AL_DEDO
          for (let i = 1; i < esquinas.length; i++) {
            const d = distanciaAlTramo(e.point, m.project(esquinas[i - 1]), m.project(esquinas[i]))
            if (d < menor) { menor = d; cual = i - 1 }
          }
          if (cual === -1) return
          const rectos = u.actual.rectos ?? []
          guardar(esquinas, { rectos: rectos.includes(cual) ? rectos.filter((r) => r !== cual) : [...rectos, cual].sort((x, y) => x - y) })
          return
        }
        if (u.modo !== 'situar' || u.actual.linea.length < 2 || u.paradas.length === 0) return
        const p = redondea([e.lngLat.lng, e.lngLat.lat])
        const enRuta = Math.round(fraccionMasCercana(u.actual.linea, p) * 10000) / 10000
        u.onParadas(u.paradas.map((q, i) => (i === u.parada ? { ...q, enRuta } : q)))
        // A la siguiente: las paradas se sitúan casi siempre seguidas.
        setParada((n) => Math.min(u.paradas.length - 1, n + 1))
      })
    }).catch(() => { if (vivo) setError('No se pudo cargar el mapa del barrio.') })
    return () => {
      vivo = false
      window.clearTimeout(aplazado)
      cancelAnimationFrame(fotograma)
      medidor?.disconnect()
      try { dibujo.current?.stop() } catch { /* el mapa ya se fue */ }
      dibujo.current = null
      creado?.remove()
      mapa.current = null
      setListo(false)
    }
    // Una sola vez: lo que cambia se lee de `ultimo`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  // Lo guardado cambió por otro lado (Deshacer, el otro recorrido, «Partir del habitual»): al dibujo.
  useEffect(() => {
    if (listo && clave(actual.esquinas) !== enDibujo.current) ponerTrazo(actual.esquinas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, actual.esquinas])

  // Lo que hace el dedo, en Terra Draw.
  useEffect(() => {
    const td = dibujo.current
    if (!listo || !td) return
    td.setMode(modo === 'puntos' ? 'linestring' : modo === 'mano' ? 'freehand-linestring' : modo === 'retocar' ? 'select' : 'static')
    if (modo === 'retocar' && idTrazo.current !== null) td.selectFeature(idTrazo.current)
  }, [listo, modo])

  // La línea, la del otro recorrido, la salida y la entrada, y lo de cada retoque.
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m || !mapaVivo(m)) return
    ;(m.getSource('rutaHecha') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: actual.linea.length >= 2 ? actual.linea : [] } })
    ;(m.getSource('rutaEntera') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: referencia.length >= 2 ? referencia : [] } })
    const { esquinas } = actual
    ;(m.getSource('editor-esquinas') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: modo === 'quitar' ? esquinas.map((p) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: p } })) : [],
    })
    ;(m.getSource('editor-rectos') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: (modo === 'rectos' ? actual.rectos ?? [] : []).filter((i) => i < esquinas.length - 1)
        .map((i) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [esquinas[i], esquinas[i + 1]] } })),
    })

    // La salida y la entrada, en el extremo de verdad de la línea de oro; si coinciden, un rótulo.
    const h = hitos.current
    if (h) {
      const ini = actual.linea[0], fin = actual.linea[actual.linea.length - 1]
      const juntas = ini && fin && metros(ini, fin) < 20
      if (ini && actual.linea.length >= 2) {
        h.salida.getElement().textContent = juntas ? 'Salida y entrada' : 'Salida'
        h.salida.setLngLat(ini).addTo(m)
      } else h.salida.remove()
      if (fin && actual.linea.length >= 2 && !juntas) {
        h.entrada.getElement().textContent = 'Entrada'
        h.entrada.setLngLat(fin).addTo(m)
      } else h.entrada.remove()
    }

    marcas.current.forEach((marca) => marca.remove())
    marcas.current = []
    if (modo === 'situar' && actual.linea.length >= 2) {
      posicionesEnRuta(paradas).forEach((f, i) => {
        const el = document.createElement('div')
        const fija = typeof paradas[i].enRuta === 'number'
        Object.assign(el.style, {
          minWidth: '20px', height: '20px', padding: '0 4px', borderRadius: '10px', display: 'grid', placeItems: 'center',
          font: '700 11px/1 sans-serif', color: '#070608', pointerEvents: 'none',
          background: i === parada ? MARCA.principalClaro : fija ? ORO : 'rgba(255,255,255,.8)',
          outline: i === parada ? '2px solid #fff' : 'none',
        })
        el.textContent = String(i + 1)
        marcas.current.push(new maplibregl.Marker({ element: el }).setLngLat(puntoEn(actual.linea, f)).addTo(m))
      })
    }
  }, [listo, actual, modo, parada, paradas, referencia])

  const situadas = paradas.filter((p) => typeof p.enRuta === 'number').length
  const hayLinea = actual.linea.length >= 2
  const retocando = modo === 'retocar' || modo === 'quitar' || modo === 'rectos'

  const deshacer = () => {
    const anterior = historia[historia.length - 1]
    if (!anterior) return
    setHistoria((h) => h.slice(0, -1))
    ponerTrazo(anterior.esquinas)
    onRecorrido({ ...actual, esquinas: anterior.esquinas, rectos: anterior.rectos, pegado: anterior.pegado, linea: anterior.linea })
  }

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        exclusive size="small" value={retocando ? 'retocar' : modo}
        onChange={(_, valor: Modo | null) => valor && setModo(valor)}
        aria-label="Qué se hace en el mapa" sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value="puntos">Por puntos</ToggleButton>
        <ToggleButton value="mano">A mano alzada</ToggleButton>
        <ToggleButton value="retocar" disabled={actual.esquinas.length < 2}>Retocar</ToggleButton>
        <ToggleButton value="situar" disabled={!hayLinea}>Paradas</ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" color="text.secondary">{AYUDA[modo]}</Typography>

      {modo === 'situar' && (
        <TextField
          select size="small" label="Parada que sitúas" value={Math.min(parada, paradas.length - 1)}
          onChange={(e) => setParada(Number(e.target.value))}
          slotProps={{ select: { native: true } }} sx={{ maxWidth: 440 }}
        >
          {paradas.map((p, i) => (
            <option key={i} value={i}>{`${i + 1}. ${p.hora ? `${p.hora} · ` : ''}${p.lugar || 'sin lugar'}${typeof p.enRuta === 'number' ? ' (situada)' : ''}`}</option>
          ))}
        </TextField>
      )}

      <Box sx={{ position: 'relative', height: { xs: 420, md: 520 }, border: 1, borderColor: 'divider', backgroundColor: FONDO, '& .maplibregl-canvas': { cursor: modo === 'situar' || modo === 'puntos' ? 'crosshair' : undefined } }}>
        {/* Dentro de una caja: MapLibre le pone al contenedor su propio `position: relative`. */}
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <Box ref={contenedor} sx={{ width: '100%', height: '100%' }} />
        </Box>
        {(error || !listo) && (
          <Typography sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#a9a3a7', fontSize: 13, p: 2, textAlign: 'center' }}>
            {error ?? 'Cargando el mapa…'}
          </Typography>
        )}
      </Box>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {modo === 'situar' ? (
          <Button size="small" disabled={situadas === 0} onClick={() => onParadas(paradas.map(({ enRuta: _quitada, ...resto }) => resto))}>
            Repartir todas solas
          </Button>
        ) : (
          <>
            <Button size="small" startIcon={<UndoIcon />} disabled={historia.length === 0} onClick={deshacer}>Deshacer</Button>
            {retocando && (
              <>
                <Button size="small" variant={modo === 'quitar' ? 'contained' : 'text'} disabled={actual.esquinas.length <= 2 && modo !== 'quitar'}
                  aria-pressed={modo === 'quitar'} onClick={() => setModo(modo === 'quitar' ? 'retocar' : 'quitar')}>
                  Quitar esquinas
                </Button>
                <Button size="small" variant={modo === 'rectos' ? 'contained' : 'text'} disabled={!actual.pegado}
                  aria-pressed={modo === 'rectos'} onClick={() => setModo(modo === 'rectos' ? 'retocar' : 'rectos')}>
                  Tramos rectos
                </Button>
                <Button size="small" startIcon={<LoopIcon />} disabled={actual.esquinas.length < 3}
                  onClick={() => { const nuevas = [...actual.esquinas, actual.esquinas[0]]; ponerTrazo(nuevas); guardar(nuevas) }}>
                  Volver a la salida
                </Button>
              </>
            )}
            <Button size="small" color="error" startIcon={<DeleteSweepOutlinedIcon />} disabled={actual.esquinas.length === 0}
              onClick={() => { ponerTrazo([]); guardar([], { rectos: [] }); setModo('puntos') }}>
              Borrar el recorrido
            </Button>
            <FormControlLabel
              control={<Switch size="small" checked={actual.pegado} onChange={(e) => guardar(actual.esquinas, { pegado: e.target.checked })} />}
              label="Pegar a las calles"
            />
          </>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {modo === 'situar'
            ? `${situadas} de ${paradas.length} paradas situadas a mano`
            : `${actual.esquinas.length} ${actual.esquinas.length === 1 ? 'esquina' : 'esquinas'}`}
        </Typography>
      </Stack>
    </Stack>
  )
}
