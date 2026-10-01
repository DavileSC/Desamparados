import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import InventarioEditPage from '../InventarioEditPage'

const prenda = {
  id: 9, numero: 'TUN-002', tipo: 'TUNICA', talla: '1.80m', estado: 'DISPONIBLE', observaciones: null, hermano: null,
}
const enser = {
  id: 4, nombre: 'Ciriales', referencia: null, categoria: null, ubicacion: null,
  cantidadOptimo: 4, cantidadBueno: 2, cantidadReparar: 0, cantidadTotal: 6,
}

afterEach(() => { vi.unstubAllGlobals() })

function montar(ruta: string, cuerpo: unknown) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(
    new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
  vi.stubGlobal('fetch', simulado)
  const router = createMemoryRouter(
    [
      { path: '/cms/inventario', element: <h1>Inventario</h1> },
      { path: '/cms/inventario/:id/editar', element: <InventarioEditPage /> },
    ],
    { initialEntries: [ruta] },
  )
  render(<HelmetProvider><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
  return simulado
}

describe('InventarioEditPage', () => {
  it('una prenda prestada no cambia de estado editando: se devuelve desde el listado', async () => {
    montar('/cms/inventario/9/editar?tipo=prenda', { ...prenda, estado: 'PRESTADA', hermano: { nombre: 'Ana', apellidos: 'Ruiz', numeroHermano: 123 } })

    const estado = await screen.findByLabelText('Estado')
    expect(estado).toBeDisabled()
    expect(estado).toHaveValue('Prestada')
    expect(screen.getByText(/registra la devolución con «devolver»/i)).toBeInTheDocument()
  })

  it('una prenda sin prestar no puede pasar a «Prestada» editando', async () => {
    const user = userEvent.setup()
    montar('/cms/inventario/9/editar?tipo=prenda', prenda)

    await user.click(await screen.findByLabelText('Estado'))
    const opciones = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(opciones).toEqual(['Disponible', 'En lavado', 'Para arreglar', 'De baja'])
  })

  it('la ficha de patrimonio se carga, se corrige y se manda: lo vacío, a null', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/inventario/4/editar', {
      ...enser, autor: 'Taller de Seco Velasco', epoca: '1958', valorTasacion: '18500.5', fechaTasacion: '2025-03-01T00:00:00.000Z',
      fotos: [{ url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', pie: 'Detalle' }],
    })
    expect(await screen.findByLabelText('Autor o taller')).toHaveValue('Taller de Seco Velasco')
    expect(screen.getByLabelText('Valor (€)')).toHaveValue('18500,5')
    expect(screen.getByLabelText('Pie de la foto 2')).toHaveValue('Detalle')
    // Con cambios sin guardar, la ficha en PDF espera: sale de lo guardado.
    await user.clear(screen.getByLabelText('Época'))
    expect(screen.getByRole('button', { name: 'Ficha en PDF' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Valor (€)'))
    await user.type(screen.getByLabelText('Valor (€)'), '19.000,25')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(simulado.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'PUT')).toBe(true))
    const put = simulado.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === 'PUT')
    const cuerpo = JSON.parse(String((put![1] as RequestInit).body))
    expect(cuerpo).toMatchObject({ epoca: null, autor: 'Taller de Seco Velasco', valorTasacion: 19000.25, fechaTasacion: '2025-03-01' })
    expect(cuerpo.fotos).toEqual([{ url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', pie: 'Detalle' }])
  })

  it('no manda un enser con cantidades decimales: avisa antes', async () => {
    const user = userEvent.setup()
    const simulado = montar('/cms/inventario/4/editar', enser)

    const optimo = await screen.findByLabelText('En estado óptimo')
    await user.clear(optimo)
    await user.type(optimo, '2.5')
    expect(screen.getByText('Solo números enteros')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(/las cantidades tienen que ser números enteros/i)).toBeInTheDocument()
    expect(simulado.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false)
  })
})
