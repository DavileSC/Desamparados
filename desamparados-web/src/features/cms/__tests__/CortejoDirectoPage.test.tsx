import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import CortejoDirectoPage from '../CortejoDirectoPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
// El itinerario lo busca el servidor entre las páginas encendidas y viene en
// cada respuesta: una recta de unos 200 m con dos paradas, la salida y el final.
const DEL_RECORRIDO = {
  ruta: '/salida/itinerario',
  recorrido: { paradas: [{ hora: '18:00', lugar: 'Salida del templo' }, { hora: '', lugar: 'Calle Larga' }], linea: [[-4.45, 36.71], [-4.4478, 36.71]] },
}
const APAGADO = { enDirecto: false, enMarcha: false, precision: null, autorNombre: null, ...DEL_RECORRIDO }

afterEach(() => { vi.unstubAllGlobals() })

function montar(geolocalizacion?: Partial<Geolocation>, inicial: unknown = APAGADO) {
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
    if (ruta.endsWith('/terminar')) return Promise.resolve(json({ ...APAGADO, enMarcha: false }))
    if (ruta.endsWith('/recorrido')) return Promise.resolve(json({ ...(inicial as object), enUso: JSON.parse(String(init.body)).enUso }))
    if (init.method === 'PUT') {
      const p = JSON.parse(String(init.body))
      return Promise.resolve(json({ enDirecto: true, enMarcha: true, ...p, actualizadoEl: '2026-10-01T17:05:00.000Z', autorNombre: 'Ana Ruiz', ...DEL_RECORRIDO }))
    }
    return Promise.resolve(json(inicial))
  })
  vi.stubGlobal('fetch', fetch)
  if (geolocalizacion) vi.stubGlobal('navigator', { ...navigator, geolocation: geolocalizacion })
  const router = createMemoryRouter([{ path: '/cms/procesion/directo', element: <CortejoDirectoPage /> }], { initialEntries: ['/cms/procesion/directo'] })
  render(<HelmetProvider><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
  return fetch
}

const envios = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT').map(([, init]) => JSON.parse(String((init as RequestInit).body)))

describe('CortejoDirectoPage', () => {
  it('sin GPS se marca a mano la parada, y el directo se termina', async () => {
    const user = userEvent.setup()
    const fetch = montar()
    expect(await screen.findByText(/no está en la calle/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Calle Larga' }))
    // La última parada cae al final de la línea.
    const [enviada] = envios(fetch)
    expect(enviada.lng).toBeCloseTo(-4.4478, 6)
    expect(enviada.precision).toBeNull()
    expect(await screen.findByText(/marcada a mano, de Ana Ruiz/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Terminar el directo' }))
    expect(await screen.findByText(/no está en la calle/)).toBeInTheDocument()
  })

  it('con GPS manda la primera posición y no repite hasta pasado el intervalo', async () => {
    const user = userEvent.setup()
    let avisar: PositionCallback = () => undefined
    const watchPosition = vi.fn((ok: PositionCallback) => { avisar = ok; return 7 })
    const clearWatch = vi.fn()
    const fetch = montar({ watchPosition, clearWatch })
    await user.click(await screen.findByRole('button', { name: 'Empezar a mandar la posición' }))
    const posicion = (lng: number) => ({ coords: { longitude: lng, latitude: 36.71, accuracy: 11.6 } }) as GeolocationPosition
    avisar(posicion(-4.449))
    avisar(posicion(-4.4489))
    expect(await screen.findByText(/±12 m/)).toBeInTheDocument()
    expect(envios(fetch)).toEqual([{ lng: -4.449, lat: 36.71, precision: 12 }])
    await user.click(screen.getByRole('button', { name: 'Dejar de mandar desde este móvil' }))
    expect(clearWatch).toHaveBeenCalledWith(7)
  })

  it('avisa si la posición queda tan lejos del recorrido que la web no la enseña', async () => {
    // Un kilómetro al norte de la línea.
    montar(undefined, { enDirecto: true, enMarcha: true, lng: -4.449, lat: 36.72, precision: 30, actualizadoEl: '2026-10-01T17:05:00.000Z', autorNombre: null, ...DEL_RECORRIDO })
    expect(await screen.findByText(/queda a 11[0-9]{2} m del recorrido/)).toBeInTheDocument()
  })

  it('«Ver el mapa» lleva a la página del itinerario', async () => {
    montar()
    expect(await screen.findByRole('link', { name: 'Ver el mapa' })).toHaveAttribute('href', '/salida/itinerario')
  })

  it('sin ninguna página con itinerario en el mapa, lo dice y no ofrece paradas ni mapa', async () => {
    montar(undefined, { ...APAGADO, ruta: null, recorrido: null })
    expect(await screen.findByText(/Ninguna página tiene un itinerario con mapa/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver el mapa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Calle Larga' })).not.toBeInTheDocument()
  })

  it('con recorrido alternativo, se cambia desde aquí el que está en uso', async () => {
    const user = userEvent.setup()
    const fetch = montar(undefined, { ...APAGADO, enUso: 'habitual', hayAlternativo: true })
    const alternativo = await screen.findByRole('button', { name: 'Alternativo' })
    expect(screen.getByRole('button', { name: 'Habitual' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(alternativo)
    const cambio = fetch.mock.calls.find(([url]) => String(url).endsWith('/cortejo-directo/admin/recorrido'))
    expect(JSON.parse(String((cambio?.[1] as RequestInit).body))).toEqual({ enUso: 'alternativo' })
    expect(await screen.findByRole('button', { name: 'Alternativo' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sin recorrido alternativo no ofrece cambiarlo', async () => {
    montar(undefined, { ...APAGADO, enUso: 'habitual', hayAlternativo: false })
    expect(await screen.findByText(/no está en la calle/)).toBeInTheDocument()
    expect(screen.queryByText('Recorrido en uso')).not.toBeInTheDocument()
  })

  it('si el navegador niega la ubicación, lo dice y ofrece las paradas', async () => {
    const user = userEvent.setup()
    const watchPosition = vi.fn((_ok: PositionCallback, mal?: PositionErrorCallback | null) => {
      mal?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError)
      return 3
    })
    montar({ watchPosition, clearWatch: vi.fn() })
    await user.click(await screen.findByRole('button', { name: 'Empezar a mandar la posición' }))
    expect(await screen.findByText(/no deja usar la ubicación/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empezar a mandar la posición' })).toBeInTheDocument()
  })
})
