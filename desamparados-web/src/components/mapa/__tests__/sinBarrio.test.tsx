import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitForElementToBeRemoved } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import type { BloqueItinerario as Datos, PaginaDeBloques } from '../../../lib/api/contenido'
import { cargarBarrio } from '../barrio'
import BloqueItinerario from '../../bloques/BloqueItinerario'
import EditorDeRecorrido from '../../../features/cms/bloques/formularios/EditorDeRecorrido'
import NoEncontradaPage from '../../../features/noEncontrado/NoEncontradaPage'

// Una instalación sin instalacion/mapas/barrio.json: /mapas/barrio.json da 404
// y nada se rompe. jsdom no pinta mapas, pero tampoco hace falta: sin barrio,
// ningún componente llega a crear el de MapLibre. Se finge WebGL para que lo
// intenten, que es el caso de verdad.
vi.mock('maplibre-gl', () => ({ setWorkerUrl: () => {} }))
vi.mock('../trabajador', () => ({}))
vi.mock('../barrio', async (original) => ({ ...(await original<typeof import('../barrio')>()), hayWebGL: () => true }))

const LINEA: [number, number][] = [[-4.44, 36.72], [-4.441, 36.721], [-4.442, 36.722]]
const ITINERARIO: Datos = {
  tipo: 'itinerario',
  titulo: '',
  paradas: [
    { hora: '19:30', lugar: 'Salida del templo' },
    { hora: '21:30', lugar: 'Regreso al templo' },
  ],
  presentacion: { disposicion: 'plano' },
  recorrido: { esquinas: LINEA, linea: LINEA, pegado: true },
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
let pedidas: string[] = []

beforeEach(() => {
  pedidas = []
  vi.stubGlobal('fetch', vi.fn((url: string | URL | Request) => {
    const ruta = String(url instanceof Request ? url.url : url)
    pedidas.push(ruta)
    if (ruta.includes('/mapas/barrio.json')) return Promise.resolve(new Response('', { status: 404 }))
    if (ruta.includes('/contenido/recorrido')) return Promise.resolve(json({ cabecera: { titulo: 'Recorrido', subtitulo: '', foto: '', fotoAlt: '' }, bloques: [ITINERARIO] } as unknown as PaginaDeBloques))
    return Promise.resolve(json({}, 404))
  }))
})
afterEach(() => vi.unstubAllGlobals())

// cargarBarrio recuerda lo que obtuvo para toda la visita: el orden importa.
// Primero el fallo de red (que no se recuerda) y después el 404 (que sí, y
// del que tiran las pruebas de los componentes).
describe('cargarBarrio', () => {
  it('un fallo de red sí es un error, y se reintenta', async () => {
    const caido = vi.fn(() => Promise.resolve(new Response('', { status: 502 })))
    vi.stubGlobal('fetch', caido)
    await expect(cargarBarrio()).rejects.toThrow('502')
    await expect(cargarBarrio()).rejects.toThrow('502')
    expect(caido).toHaveBeenCalledTimes(2)
  })

  it('sin el fichero da null (no hay barrio), y no lo vuelve a pedir', async () => {
    expect(await cargarBarrio()).toBeNull()
    expect(await cargarBarrio()).toBeNull()
    expect(pedidas.filter((r) => r === '/mapas/barrio.json')).toHaveLength(1)
  })
})

describe('sin mapa del barrio', () => {
  it('el itinerario «sobre el mapa» se queda en la línea, con todas sus paradas', async () => {
    renderWithProviders(<BloqueItinerario bloque={ITINERARIO} />)
    // El mapa llega a montarse (no se sabe que no hay barrio hasta pedirlo) y se retira.
    const mapa = await screen.findByRole('img', { name: /Mapa del recorrido/ }, { timeout: 15000 })
    await waitForElementToBeRemoved(mapa, { timeout: 15000 })
    const lista = screen.getByRole('list')
    expect(lista.textContent).toContain('Salida del templo')
    expect(lista.textContent).toContain('Regreso al templo')
  })

  it('el editor del CMS dice que esta instalación no tiene mapa, sin romperse', async () => {
    renderWithProviders(<EditorDeRecorrido recorrido={undefined} paradas={ITINERARIO.paradas} onRecorrido={() => {}} onParadas={() => {}} />)
    expect(await screen.findByText(/no tiene mapa del barrio/, {}, { timeout: 15000 })).toBeInTheDocument()
  })

  it('la 404 se queda con el texto: el mapa se retira en cuanto se sabe que no hay barrio', async () => {
    // El recorrido es de las páginas propias: sin ellas, la 404 ni lo pide.
    renderWithProviders(<NoEncontradaPage />, { ruta: '/esta-no-existe', modulos: ['paginas-propias'] })
    // Con margen: el mapa espera al navegador libre y baja su trozo aparte antes
    // de pedir el barrio; con la suite entera en la verificación pasó de 5 s (13-10-2026).
    const mapa = await screen.findByRole('img', { name: /Mapa del recorrido/ }, { timeout: 15000 })
    await waitForElementToBeRemoved(mapa, { timeout: 15000 })
    expect(screen.getByRole('heading', { level: 1, name: 'Esta calle no está en el recorrido' })).toBeInTheDocument()
  })
})
