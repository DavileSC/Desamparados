import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { crearTemaCms } from '../../../../theme/cms'
import PuertaTemploPage from '../PuertaTemploPage'
import { salidasDePrueba, esListaDeSalidas } from '../../../../test/salidas'
import type { Salida } from '../../../../lib/api/salidas'
import { useAuthStore } from '../../../altas/auth/store'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const ANA = { id: 7, nombre: 'Ana', apellidos: 'Ruiz Gil', numeroHermano: 120, puesto: 'Nazareno', tramo: 'Tramo 2', numero: 4, year: 2027, salida: 'sabado-de-pasion', entradaEl: null, entradaPor: null }
const LUIS = { ...ANA, id: 8, nombre: 'Luis', apellidos: 'Mora Paz', numeroHermano: 33, tramo: 'Tramo 1', numero: 1 }
const ESTADO = {
  salida: 'sabado-de-pasion', year: 2027, total: 2, dentro: 0,
  tramos: [{ tramo: 'Tramo 1', total: 1, dentro: 0 }, { tramo: 'Tramo 2', total: 1, dentro: 0 }],
  faltan: [LUIS, ANA], ultimas: [],
}

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); useAuthStore.setState({ cms: null }) })

function montar(escaneo: unknown, salidas: Salida[] | 'error' = salidasDePrueba) {
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
    if (esListaDeSalidas(ruta)) return Promise.resolve(salidas === 'error' ? json({ error: 'Fallo' }, 500) : json(salidas))
    if (ruta.endsWith('/puerta/escanear')) return Promise.resolve(json(escaneo))
    if (init.method === 'POST' && ruta.includes('/puerta/papeletas/')) return Promise.resolve(json({ veredicto: 'ENTRA', papeleta: { ...ANA, entradaEl: '2027-04-10T16:00:00.000Z' } }))
    return Promise.resolve(json(ESTADO))
  })
  vi.stubGlobal('fetch', fetch)
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <HelmetProvider><QueryClientProvider client={cliente}><ThemeProvider theme={crearTemaCms('claro')}>
      <MemoryRouter><PuertaTemploPage /></MemoryRouter>
    </ThemeProvider></QueryClientProvider></HelmetProvider>,
  )
  return fetch
}

describe('PuertaTemploPage', () => {
  it('cuenta por tramos y lista a los que faltan', async () => {
    montar({ veredicto: 'FALSO', papeleta: null })
    expect(await screen.findByText('Sábado de Pasión 2027 · 0 de 2 dentro')).toBeInTheDocument()
    expect(screen.getByLabelText('Tramo 1: 0 de 1 dentro')).toBeInTheDocument()
    expect(screen.getByText('Luis Mora Paz')).toBeInTheDocument()
    expect(screen.getByText('Nazareno · Tramo 2 · n.º 4')).toBeInTheDocument()
  })

  it('un código del lector de mano: dice quién es y a qué tramo va', async () => {
    const user = userEvent.setup()
    const fetch = montar({ veredicto: 'ENTRA', papeleta: { ...ANA, entradaEl: '2027-04-10T16:00:00.000Z' } })
    await screen.findByText('Luis Mora Paz')
    await user.type(screen.getByLabelText('Código de la papeleta'), 'DSP1.7.abcdefghijklmnop{Enter}')
    expect(await screen.findByText('Adelante')).toBeInTheDocument()
    expect(screen.getByText('Ana Ruiz Gil · n.º 120')).toBeInTheDocument()
    const envio = fetch.mock.calls.find(([u]) => String(u).endsWith('/puerta/escanear'))!
    expect(JSON.parse(String((envio[1] as RequestInit).body))).toEqual({ codigo: 'DSP1.7.abcdefghijklmnop', salida: 'sabado-de-pasion' })
  })

  it('la papeleta de otra salida dice de cuál es, por su nombre', async () => {
    const user = userEvent.setup()
    montar({ veredicto: 'OTRA_SALIDA', papeleta: { ...ANA, salida: 'rosario-vespertino', year: 2026 } })
    await screen.findByText('Luis Mora Paz')
    expect(screen.getByRole('group', { name: 'Salida' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Código de la papeleta'), 'DSP1.7.abcdefghijklmnop{Enter}')
    expect(await screen.findByText('Es del Rosario vespertino 2026, no del Sábado de Pasión 2027.')).toBeInTheDocument()
  })

  it('cambiar de salida pide la puerta de la otra y lo recuerda', async () => {
    const user = userEvent.setup()
    const fetch = montar({ veredicto: 'FALSO', papeleta: null })
    await screen.findByText('Luis Mora Paz')
    expect(fetch.mock.calls.some(([u]) => String(u).includes('/puerta?salida=sabado-de-pasion'))).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Rosario vespertino' }))
    expect(fetch.mock.calls.some(([u]) => String(u).includes('/puerta?salida=rosario-vespertino'))).toBe(true)
    expect(localStorage.getItem('puerta.salida')).toBe('rosario-vespertino')
  })

  it('sin salidas activas lo dice y, a Secretaría, la lleva a crearlas', async () => {
    useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'secre@ejemplo.es', role: 'SECRETARIA', perfiles: [], origen: 'cms' }, hermano: null })
    montar({ veredicto: 'FALSO', papeleta: null }, [])
    expect(await screen.findByText(/no hay salidas activas/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Procesión → Salidas' })).toHaveAttribute('href', '/cms/procesion/salidas')
  })

  it('un diputado de la puerta ve el aviso sin enlace', async () => {
    useAuthStore.setState({ status: 'listo', cms: { id: 2, email: 'puerta@ejemplo.es', role: 'TESORERIA', perfiles: [], origen: 'cms' }, hermano: null })
    montar({ veredicto: 'FALSO', papeleta: null }, [])
    expect(await screen.findByText(/pídelas a secretaría/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Procesión → Salidas' })).not.toBeInTheDocument()
  })

  it('si no se pueden cargar las salidas, lo dice como error', async () => {
    montar({ veredicto: 'FALSO', papeleta: null }, 'error')
    expect(await screen.findByText('No se han podido cargar las salidas.')).toBeInTheDocument()
  })

  it('un código falso se dice en rojo', async () => {
    const user = userEvent.setup()
    montar({ veredicto: 'FALSO', papeleta: null })
    await screen.findByText('Luis Mora Paz')
    await user.type(screen.getByLabelText('Código de la papeleta'), 'cualquier cosa{Enter}')
    expect(await screen.findByText('No es una papeleta válida')).toBeInTheDocument()
  })

  it('quien llega sin la papeleta se busca y se marca a mano', async () => {
    const user = userEvent.setup()
    const fetch = montar({ veredicto: 'FALSO', papeleta: null })
    await screen.findByText('Luis Mora Paz')
    await user.type(screen.getByLabelText('Buscar por nombre, número o tramo'), 'ruiz')
    expect(screen.queryByText('Luis Mora Paz')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ha entrado' }))
    expect(await screen.findByText('Adelante')).toBeInTheDocument()
    expect(fetch.mock.calls.some(([u, i]) => String(u).endsWith('/puerta/papeletas/7') && (i as RequestInit).method === 'POST')).toBe(true)
  })
})
