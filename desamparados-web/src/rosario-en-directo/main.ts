import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@fontsource-variable/montserrat'
import '../components/mapa/trabajador'
import { ATRIBUCION, centroDe, edificioDelTemplo, hayWebGL, type Barrio } from '../components/mapa/barrio'
import { estiloDelMapa } from '../components/mapa/estilo'
import { DISTANCIA_MAXIMA_M, acumulados, metros, tramoHasta } from '../components/bloques/recorrido'
import { horaEnMadrid } from '../lib/horaDeMadrid'
import type { Coordenada } from '../lib/api/contenido'
import { MARCA, alfa } from '../theme/marca'
import { CALLES, RUTA } from './ruta'
import './rosario.css'

/**
 * El Rosario vespertino en directo, en una página suelta del dominio
 * principal (desamparadosmalaga.com/Rosario) mientras la web sigue en
 * pruebas. No lleva nada de la web: el mapa del barrio, la línea del
 * recorrido y la posición que manda la Junta desde «Cortejo en directo» del
 * CMS, que nginx deja leer en /Rosario/posicion y nada más.
 */

const BASE = import.meta.env.BASE_URL
/** Lo mismo que el mapa de la web: la posición no cambia más deprisa (el móvil la manda cada 15 s). */
const SONDEO_MS = 20_000
const CAMARA_CERCA = { zoom: 17, pitch: 52, bearing: -12 }
const MARGEN = { top: 110, right: 32, left: 32 }
/**
 * El recorrido sale y vuelve por la misma esquina, y algunas calles se pisan:
 * un punto puede caer a la vez al principio y al final. Se prefiere el tramo
 * que sigue al último conocido, con este margen hacia atrás por los saltos del GPS.
 */
const ATRAS_PERMITIDO_M = 60
/** Entre dos tramos que casi empatan en distancia, manda el orden del cortejo. */
const EMPATE_M = 25

interface Posicion { enDirecto: boolean; lng?: number; lat?: number; actualizadoEl?: string }

const hechos = acumulados(RUTA)
const total = hechos[hechos.length - 1]

/** La calle de ese punto del recorrido (en metros andados): la última que ha empezado. */
const calleEn = (andado: number) => CALLES.findLast((c) => hechos[c.esquina] <= andado) ?? CALLES[0]

/** Los metros andados del recorrido en ese punto, y a qué distancia de la línea queda. */
function sobreLaRuta(p: Coordenada, anterior: number): { recorrido: number; distancia: number } {
  const coseno = Math.cos((p[1] * Math.PI) / 180)
  const x = (c: Coordenada) => (c[0] - p[0]) * 111320 * coseno
  const y = (c: Coordenada) => (c[1] - p[1]) * 111320
  const candidatos: { recorrido: number; distancia: number }[] = []
  for (let i = 1; i < RUTA.length; i++) {
    const ax = x(RUTA[i - 1]), ay = y(RUTA[i - 1])
    const dx = x(RUTA[i]) - ax, dy = y(RUTA[i]) - ay
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / l2))
    candidatos.push({ recorrido: hechos[i - 1] + (hechos[i] - hechos[i - 1]) * t, distancia: Math.hypot(ax + dx * t, ay + dy * t) })
  }
  const mejor = Math.min(...candidatos.map((c) => c.distancia))
  const parecidos = candidatos.filter((c) => c.distancia <= mejor + EMPATE_M)
  const hacia = parecidos.filter((c) => c.recorrido >= anterior - ATRAS_PERMITIDO_M).sort((a, b) => a.recorrido - b.recorrido)[0]
  return hacia ?? candidatos.find((c) => c.distancia === mejor)!
}

function caja(): maplibregl.LngLatBounds {
  const c = new maplibregl.LngLatBounds(RUTA[0], RUTA[0])
  RUTA.forEach((p) => c.extend(p))
  return c
}

// Los colores de la marca solo los sabe marca.ts: la hoja de estilos los toma de aquí.
document.documentElement.style.setProperty('--oro', MARCA.acento)
document.documentElement.style.setProperty('--oro-tenue', alfa(MARCA.acento, 0.5))
document.documentElement.style.setProperty('--granate', MARCA.principalClaro)

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const estado = $('estado')
const titulo = $('titulo')
const hora = $<HTMLTimeElement>('hora')
const detalle = $('detalle')
const pie = document.querySelector<HTMLElement>('.pie')!
const botonSeguir = $<HTMLButtonElement>('seguir')
const botonEntero = $<HTMLButtonElement>('entero')

/** En directo basta la calle y la hora de la posición; el texto de debajo queda para los avisos. */
function avisar(cabecera: string, texto: string, vivo = false, horaDeLaPosicion = '') {
  titulo.textContent = cabecera
  hora.textContent = horaDeLaPosicion
  hora.dateTime = horaDeLaPosicion
  estado.dataset.vivo = String(vivo)
  detalle.textContent = texto
}

/**
 * El pie cambia de alto (un aviso de varias líneas o solo la calle): el
 * recorrido se encuadra por encima de él, y la atribución del mapa también.
 */
const margen = () => ({ ...MARGEN, bottom: pie.offsetHeight + 12 })
new ResizeObserver(() => document.documentElement.style.setProperty('--alto-pie', `${pie.offsetHeight + 8}px`)).observe(pie)

async function arrancar() {
  if (!hayWebGL()) {
    avisar('Este navegador no puede pintar el mapa', 'Prueba a abrir la página en otro navegador o en el móvil.')
    return
  }
  const respuesta = await fetch(`${BASE}barrio.json`)
  if (!respuesta.ok) throw new Error(`barrio ${respuesta.status}`)
  const barrio = await respuesta.json() as Barrio
  const templo = edificioDelTemplo(barrio, RUTA[0])
  // Las letras de las calles, también dentro de /Rosario/: fuera de ahí el dominio no sirve nada.
  const estilo: StyleSpecification = { ...estiloDelMapa(barrio, templo), glyphs: `${window.location.origin}${BASE}fuentes/{fontstack}/{range}.pbf` }

  const mapa = new maplibregl.Map({
    container: 'mapa',
    style: estilo,
    attributionControl: false,
    bounds: caja(),
    fitBoundsOptions: { padding: margen() },
    maxBounds: [[barrio.caja[0], barrio.caja[1]], [barrio.caja[2], barrio.caja[3]]],
  })
  mapa.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: ATRIBUCION }), 'bottom-right')
  mapa.touchPitch.disable()

  const salida = document.createElement('span')
  salida.className = 'rotulo-salida'
  salida.textContent = 'Sª María Goretti'
  new maplibregl.Marker({ element: salida, anchor: 'bottom', offset: [0, -16] }).setLngLat(templo ? centroDe(templo) : RUTA[0]).addTo(mapa)

  const punto = document.createElement('div')
  punto.className = 'trono'
  Object.assign(punto.style, {
    background: MARCA.principal, border: `2px solid ${MARCA.principalClaro}`,
    boxShadow: `0 0 0 7px ${alfa(MARCA.principalClaro, 0.22)}, 0 0 18px ${alfa(MARCA.principalClaro, 0.5)}`,
  })
  // La calle por la que va, pequeña y al lado del trono: no tapa el mapa.
  const rotuloCalle = document.createElement('span')
  rotuloCalle.className = 'calle-del-trono'
  punto.appendChild(rotuloCalle)
  const trono = new maplibregl.Marker({ element: punto }).setLngLat(RUTA[0])

  let camara: 'sigue' | 'entero' | 'libre' = 'entero'
  let andado = 0
  let ultima: Coordenada | null = null

  const ponerCamara = (nueva: typeof camara) => {
    camara = nueva
    botonSeguir.setAttribute('aria-pressed', String(camara === 'sigue'))
    botonEntero.setAttribute('aria-pressed', String(camara === 'entero'))
    if (camara === 'sigue' && ultima) mapa.easeTo({ center: ultima, ...CAMARA_CERCA, duration: 1200 })
    if (camara === 'entero') mapa.fitBounds(caja(), { padding: margen(), pitch: 0, bearing: 0, duration: 1000 })
  }
  botonSeguir.addEventListener('click', () => ponerCamara('sigue'))
  botonEntero.addEventListener('click', () => ponerCamara('entero'))
  // Quien mueve el mapa con el dedo manda: la cámara deja de ir sola hasta que pulse un botón.
  mapa.on('dragstart', () => { if (camara !== 'libre') ponerCamara('libre') })

  await new Promise<void>((listo) => mapa.on('load', () => listo()))
  ;(mapa.getSource('rutaEntera') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: RUTA } })

  const pintar = (p: Posicion) => {
    if (!p.enDirecto || p.lng === undefined || p.lat === undefined || !p.actualizadoEl) {
      trono.remove()
      ;(mapa.getSource('rutaHecha') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [] })
      avisar('Aún no hay posición en directo', 'El Rosario sale del Templo al terminar la misa de las 19:00. Esta página se actualiza sola: no hace falta recargarla.')
      botonSeguir.disabled = true
      return
    }
    const sobre = sobreLaRuta([p.lng, p.lat], andado)
    const horaDeLaPosicion = horaEnMadrid(p.actualizadoEl)
    if (sobre.distancia > DISTANCIA_MAXIMA_M) {
      // Un GPS que se va lejos de la línea engaña más que no enseñar nada:
      // se queda el trono donde estaba (o sin pintar) hasta que vuelva.
      avisar('El Rosario está en la calle', `Ahora mismo la posición no es fiable (última a las ${horaDeLaPosicion}). Se actualiza sola.`, true)
      return
    }
    andado = sobre.recorrido
    const tramo = tramoHasta(RUTA, andado / total, hechos)
    const aqui = tramo[tramo.length - 1]
    ;(mapa.getSource('rutaHecha') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tramo.length > 1 ? tramo : [aqui, aqui] } })
    trono.setLngLat(aqui).addTo(mapa)
    const primera = ultima === null
    ultima = aqui
    botonSeguir.disabled = false
    const queda = Math.max(0, total - andado)
    const calle = calleEn(andado)
    rotuloCalle.textContent = calle.nombre
    rotuloCalle.dataset.cruce = String(Boolean(calle.cruce))
    const llegando = queda < 40 && metros(aqui, RUTA[0]) < 40
    avisar(llegando ? 'Llegando al Templo' : calle.cruce ? calle.nombre : `Ahora por ${calle.nombre}`, '', true, horaDeLaPosicion)
    if (primera) ponerCamara('sigue')
    else if (camara === 'sigue') mapa.easeTo({ center: aqui, duration: 1500 })
  }

  const preguntar = async () => {
    try {
      const r = await fetch(`${BASE}posicion`, { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      pintar(await r.json() as Posicion)
    } catch {
      avisar('Sin conexión con el servidor', 'Se vuelve a intentar sola en unos segundos.')
    }
  }
  await preguntar()
  window.setInterval(() => { if (!document.hidden) void preguntar() }, SONDEO_MS)
  // Al volver a la pestaña (el móvil en el bolsillo), la posición al momento y no a los 20 s.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void preguntar() })
}

arrancar().catch(() => avisar('No se ha podido cargar el mapa', 'Recarga la página dentro de un momento.'))
