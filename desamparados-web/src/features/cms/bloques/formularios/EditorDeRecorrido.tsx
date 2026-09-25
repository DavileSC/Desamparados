/**
 * El editor del recorrido sobre el mapa del barrio: se pulsan las esquinas en
 * el orden en que anda la procesión y la línea va de una a otra pegada a las
 * calles; después se sitúa cada parada pulsando en su sitio.
 *
 * Lleva MapLibre, así que se carga aparte (ver `listas.tsx`), solo al abrir un
 * itinerario.
 */
import { useEffect, useRef, useState } from 'react'
import { Box, Button, FormControlLabel, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import UndoIcon from '@mui/icons-material/Undo'
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined'
import LoopIcon from '@mui/icons-material/Loop'
import maplibregl, { type GeoJSONSource, type Map as Mapa, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import topes from '../../../../../../shared/topes-contenido.json'
import { ATRIBUCION, cargarBarrio, edificioDelTemplo, hayWebGL, mapaVivo } from '../../../../components/mapa/barrio'
import { estiloDelMapa, ORO } from '../../../../components/mapa/estilo'
import { construirGrafo, lineaDelRecorrido, type Grafo } from '../../../../components/mapa/grafo'
import { fraccionMasCercana, posicionesEnRuta, puntoEn } from '../../../../components/bloques/recorrido'
import type { Coordenada, ParadaRecorrido, RecorridoEnMapa } from '../../../../lib/api/contenido'

const VACIO: RecorridoEnMapa = { esquinas: [], linea: [], pegado: true }
const redondea = (c: Coordenada): Coordenada => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6]

interface Props {
  recorrido: RecorridoEnMapa | undefined
  paradas: ParadaRecorrido[]
  onRecorrido: (recorrido: RecorridoEnMapa) => void
  onParadas: (paradas: ParadaRecorrido[]) => void
}

type Modo = 'dibujar' | 'situar'

export default function EditorDeRecorrido({ recorrido, paradas, onRecorrido, onParadas }: Props) {
  const actual = recorrido ?? VACIO
  const [modo, setModo] = useState<Modo>(actual.linea.length >= 2 ? 'situar' : 'dibujar')
  const [parada, setParada] = useState(0)
  const [grafo, setGrafo] = useState<Grafo | null>(null)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(hayWebGL() ? null : 'Este navegador no puede pintar el mapa (no tiene WebGL).')

  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<Mapa | null>(null)
  const marcas = useRef<Marker[]>([])
  // El clic del mapa se engancha una vez: lee siempre lo último por aquí.
  const ultimo = useRef({ actual, modo, parada, paradas, grafo, onRecorrido, onParadas })
  ultimo.current = { actual, modo, parada, paradas, grafo, onRecorrido, onParadas }

  /** Guarda unas esquinas nuevas y la línea que sale de ellas. */
  const conEsquinas = (esquinas: Coordenada[], pegado = ultimo.current.actual.pegado) => {
    ultimo.current.onRecorrido({ esquinas, linea: lineaDelRecorrido(esquinas, pegado, ultimo.current.grafo), pegado })
  }

  useEffect(() => {
    if (error) return
    let vivo = true
    let creado: Mapa | null = null
    let medidor: ResizeObserver | null = null
    cargarBarrio().then((barrio) => {
      if (!vivo || !contenedor.current) return
      setGrafo(construirGrafo(barrio))
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
      m.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: ATRIBUCION }), 'bottom-right')
      m.on('load', () => {
        if (!vivo) return
        // Para editar, plano: los edificios en relieve taparían las calles.
        m.setPaintProperty('edificios', 'fill-extrusion-height', 0)
        const linea = ultimo.current.actual.linea
        if (linea.length >= 2) {
          const caja = new maplibregl.LngLatBounds(linea[0], linea[0])
          linea.forEach((p) => caja.extend(p))
          m.fitBounds(caja, { padding: 40, duration: 0 })
        }
        setListo(true)
      })
      m.on('click', (e) => {
        const u = ultimo.current
        const p = redondea([e.lngLat.lng, e.lngLat.lat])
        if (u.modo === 'dibujar') {
          if (u.actual.esquinas.length >= topes.puntosPorTrazado) return
          conEsquinas([...u.actual.esquinas, p])
          return
        }
        if (u.actual.linea.length < 2 || u.paradas.length === 0) return
        const enRuta = Math.round(fraccionMasCercana(u.actual.linea, p) * 10000) / 10000
        u.onParadas(u.paradas.map((q, i) => (i === u.parada ? { ...q, enRuta } : q)))
        // A la siguiente: las paradas se sitúan casi siempre seguidas.
        setParada((n) => Math.min(u.paradas.length - 1, n + 1))
      })
    }).catch(() => { if (vivo) setError('No se pudo cargar el mapa del barrio.') })
    return () => {
      vivo = false
      medidor?.disconnect()
      creado?.remove()
      mapa.current = null
      setListo(false)
    }
    // Una sola vez: lo que cambia se lee de `ultimo`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  // La línea, las esquinas (arrastrables al dibujar) y las paradas numeradas.
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m || !mapaVivo(m)) return
    ;(m.getSource('rutaHecha') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: actual.linea.length >= 2 ? actual.linea : [] } })
    marcas.current.forEach((marca) => marca.remove())
    marcas.current = []
    if (modo === 'dibujar') {
      actual.esquinas.forEach((esquina, i) => {
        const el = document.createElement('div')
        const ultima = i === actual.esquinas.length - 1
        Object.assign(el.style, {
          width: ultima ? '14px' : '11px', height: ultima ? '14px' : '11px', borderRadius: '50%', cursor: 'grab',
          background: i === 0 ? '#fc858a' : ORO, border: '2px solid #100e11',
        })
        el.title = i === 0 ? 'Salida' : `Esquina ${i + 1}`
        const marca = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(esquina).addTo(m)
        marca.on('dragend', () => {
          const { lng, lat } = marca.getLngLat()
          conEsquinas(ultimo.current.actual.esquinas.map((q, j) => (j === i ? redondea([lng, lat]) : q)))
        })
        marcas.current.push(marca)
      })
    } else if (actual.linea.length >= 2) {
      posicionesEnRuta(paradas).forEach((f, i) => {
        const el = document.createElement('div')
        const fija = typeof paradas[i].enRuta === 'number'
        Object.assign(el.style, {
          minWidth: '20px', height: '20px', padding: '0 4px', borderRadius: '10px', display: 'grid', placeItems: 'center',
          font: '700 11px/1 sans-serif', color: '#100e11', pointerEvents: 'none',
          background: i === parada ? '#fc858a' : fija ? ORO : 'rgba(255,255,255,.8)',
          outline: i === parada ? '2px solid #fff' : 'none',
        })
        el.textContent = String(i + 1)
        marcas.current.push(new maplibregl.Marker({ element: el }).setLngLat(puntoEn(actual.linea, f)).addTo(m))
      })
    }
  }, [listo, actual.linea, actual.esquinas, modo, parada, paradas])

  const situadas = paradas.filter((p) => typeof p.enRuta === 'number').length
  const hayLinea = actual.linea.length >= 2

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup exclusive size="small" value={modo} onChange={(_, valor: Modo | null) => valor && setModo(valor)} aria-label="Qué se hace al pulsar en el mapa">
        <ToggleButton value="dibujar">Dibujar el recorrido</ToggleButton>
        <ToggleButton value="situar" disabled={!hayLinea}>Situar las paradas</ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" color="text.secondary">
        {modo === 'dibujar'
          ? 'Pulsa en el mapa cada esquina del recorrido, en el orden en que anda la procesión: de la salida a la entrada. La línea va sola por las calles de una esquina a la siguiente. Arrastra una esquina para corregirla; con la rueda del ratón te acercas.'
          : 'Elige la parada y pulsa en su sitio del recorrido: se engancha a la línea. Las que no sitúes se reparten solas entre las demás.'}
      </Typography>

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

      <Box sx={{ position: 'relative', height: { xs: 360, md: 480 }, border: 1, borderColor: 'divider', backgroundColor: '#1a181b', '& .maplibregl-canvas': { cursor: 'crosshair' } }}>
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
        {modo === 'dibujar' ? (
          <>
            <Button size="small" startIcon={<UndoIcon />} disabled={actual.esquinas.length === 0} onClick={() => conEsquinas(actual.esquinas.slice(0, -1))}>
              Quitar la última esquina
            </Button>
            <Button size="small" startIcon={<LoopIcon />} disabled={actual.esquinas.length < 3} onClick={() => conEsquinas([...actual.esquinas, actual.esquinas[0]])}>
              Volver a la salida
            </Button>
            <Button size="small" color="error" startIcon={<DeleteSweepOutlinedIcon />} disabled={actual.esquinas.length === 0} onClick={() => conEsquinas([])}>
              Borrar el recorrido
            </Button>
            <FormControlLabel
              control={<Switch size="small" checked={actual.pegado} onChange={(e) => conEsquinas(actual.esquinas, e.target.checked)} />}
              label="Pegar a las calles"
            />
          </>
        ) : (
          <Button size="small" disabled={situadas === 0} onClick={() => onParadas(paradas.map(({ enRuta: _quitada, ...resto }) => resto))}>
            Repartir todas solas
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {modo === 'dibujar'
            ? `${actual.esquinas.length} ${actual.esquinas.length === 1 ? 'esquina: pulsa otra para que haya línea' : 'esquinas'}`
            : `${situadas} de ${paradas.length} paradas situadas a mano`}
        </Typography>
      </Stack>
    </Stack>
  )
}
