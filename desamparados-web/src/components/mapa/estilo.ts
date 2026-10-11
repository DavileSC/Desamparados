import type { Feature, Polygon } from 'geojson'
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { Barrio } from './barrio'

/**
 * El estilo del mapa: oscuro, con los colores de la web. Calles en gris
 * cálido, zonas verdes apagadas, edificios en relieve y la línea del recorrido
 * en el dorado de la casa, que es lo único que brilla.
 *
 * Fuentes propias: los nombres de calle usan las letras de
 * `public/mapas/fuentes/` (Open Sans Semibold, de las de MapLibre), así que
 * tampoco se piden letras a nadie.
 */
export const ORO = '#dec72b'
const FONDO_MAPA = '#0b0a0c'
const FUENTE = ['OpenSansSemibold']

const vacia = { type: 'FeatureCollection' as const, features: [] }

const anchoCalle = (mayor: number, menor: number, otra: number): ExpressionSpecification =>
  ['match', ['get', 'clase'], 'mayor', mayor, 'menor', menor, otra]

/**
 * Con `templo`, ese edificio sale de los demás y se pinta aparte: en relieve,
 * en oro viejo, con un halo dorado en el suelo. Es de donde sale y adonde
 * vuelve el recorrido.
 */
export function estiloDelMapa(barrio: Barrio, templo: Feature<Polygon> | null = null): StyleSpecification {
  const edificios = templo ? { ...barrio.edificios, features: barrio.edificios.features.filter((f) => f !== templo) } : barrio.edificios
  const delTemplo = templo ? { type: 'FeatureCollection' as const, features: [templo] } : vacia
  return {
    version: 8,
    // Una URL entera: MapLibre pide las letras desde su worker, que no sabe de rutas relativas.
    glyphs: `${window.location.origin}/mapas/fuentes/{fontstack}/{range}.pbf`,
    sources: {
      calles: { type: 'geojson', data: barrio.calles },
      edificios: { type: 'geojson', data: edificios },
      templo: { type: 'geojson', data: delTemplo },
      verdes: { type: 'geojson', data: barrio.verdes },
      rutaEntera: { type: 'geojson', data: vacia },
      rutaHecha: { type: 'geojson', data: vacia },
      paradas: { type: 'geojson', data: vacia },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': FONDO_MAPA } },
      { id: 'verdes', type: 'fill', source: 'verdes', paint: { 'fill-color': '#232b25', 'fill-opacity': 0.9 } },
      {
        id: 'calles-borde', type: 'line', source: 'calles', filter: ['!=', ['get', 'clase'], 'peatonal'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#080708',
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 2, 17, anchoCalle(16, 10, 6), 19, anchoCalle(40, 26, 14)],
        },
      },
      {
        id: 'calles', type: 'line', source: 'calles', filter: ['!=', ['get', 'clase'], 'peatonal'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'clase'], 'mayor', '#4d4648', 'menor', '#3b3538', '#2f2a2d'],
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 1, 17, anchoCalle(13, 8, 4), 19, anchoCalle(34, 22, 10)],
        },
      },
      {
        id: 'peatonales', type: 'line', source: 'calles', filter: ['==', ['get', 'clase'], 'peatonal'],
        paint: { 'line-color': '#242125', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 17, 2, 19, 4], 'line-dasharray': [2, 1.5] },
      },
      // El halo del templo, en el suelo: debajo de los edificios, para que
      // asome alrededor de la iglesia sin tapar a las vecinas.
      {
        id: 'templo-halo', type: 'line', source: 'templo',
        paint: { 'line-color': ORO, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 6, 18, 22], 'line-blur': ['interpolate', ['linear'], ['zoom'], 14, 6, 18, 18], 'line-opacity': 0.55 },
      },
      { id: 'templo-suelo', type: 'fill', source: 'templo', paint: { 'fill-color': ORO, 'fill-opacity': 0.3 } },
      {
        id: 'edificios', type: 'fill-extrusion', source: 'edificios',
        paint: { 'fill-extrusion-color': '#2b2729', 'fill-extrusion-height': ['get', 'alto'], 'fill-extrusion-opacity': 0.92 },
      },
      {
        id: 'templo', type: 'fill-extrusion', source: 'templo',
        paint: { 'fill-extrusion-color': '#8a7630', 'fill-extrusion-height': ['get', 'alto'], 'fill-extrusion-opacity': 0.95, 'fill-extrusion-vertical-gradient': true },
      },
      {
        id: 'ruta-entera', type: 'line', source: 'rutaEntera',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(227, 216, 191, 0.35)', 'line-width': 2, 'line-dasharray': [1.5, 2] },
      },
      {
        id: 'ruta-brillo', type: 'line', source: 'rutaHecha',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ORO, 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.45 },
      },
      {
        id: 'ruta-hecha', type: 'line', source: 'rutaHecha',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ORO, 'line-width': 4.5 },
      },
      {
        id: 'paradas', type: 'circle', source: 'paradas',
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['case', ['get', 'hecha'], ORO, FONDO_MAPA],
          'circle-stroke-width': 2,
          'circle-stroke-color': ['case', ['get', 'hecha'], ORO, '#cbc5c8'],
        },
      },
      {
        id: 'nombres', type: 'symbol', source: 'calles', minzoom: 15.5, filter: ['!=', ['get', 'nombre'], ''],
        layout: {
          'symbol-placement': 'line', 'text-field': ['get', 'nombre'], 'text-font': FUENTE,
          'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 10, 18, 13], 'text-letter-spacing': 0.04, 'symbol-spacing': 320,
        },
        paint: { 'text-color': '#a59d98', 'text-halo-color': FONDO_MAPA, 'text-halo-width': 1.6 },
      },
    ],
  }
}
