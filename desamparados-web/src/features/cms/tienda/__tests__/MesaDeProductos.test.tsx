import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import TiendaAdminPage from '../../TiendaAdminPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const CAMISETA = {
  id: 4, nombre: 'Camiseta', descripcion: 'Negra', precio: 12, foto: null, fotos: [], existencias: null, activo: true, orden: 0,
  tallas: [{ id: 40, nombre: 'M', existencias: 8 }, { id: 41, nombre: 'XXL', existencias: 0 }],
}
const ESTAMPA = { id: 5, nombre: 'Estampa', descripcion: '', precio: 1, foto: null, fotos: [], existencias: null, activo: true, orden: 1, tallas: [] }

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const u = String(url)
    const metodo = init.method ?? 'GET'
    const cuerpo = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    llamadas.push({ url: u, metodo, cuerpo })
    if (metodo === 'PUT') return Promise.resolve(json({ ...CAMISETA, ...cuerpo, tallas: ((cuerpo?.tallas ?? []) as { nombre: string }[]).map((t, i) => ({ id: 50 + i, ...t })) }))
    if (u.includes('/tienda/admin/pedidos')) return Promise.resolve(json([]))
    return Promise.resolve(json([CAMISETA, ESTAMPA]))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('TiendaAdminPage · productos en mesa', () => {
  it('la ficha del elegido al lado de la lista; las tallas se cambian y se guardan con lo que queda de cada una', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda' })

    const lista = await screen.findByRole('region', { name: 'Productos' })
    expect(within(lista).getByText('Quedan 8')).toBeInTheDocument()
    const ficha = screen.getByRole('region', { name: 'Ficha de Camiseta' })
    expect(within(ficha).getByLabelText('Quedan de la talla M')).toHaveValue('8')

    await user.clear(within(ficha).getByLabelText('Quedan de la talla XXL'))
    await user.type(within(ficha).getByLabelText('Quedan de la talla XXL'), '2')
    await user.click(within(ficha).getByRole('button', { name: 'Añadir talla' }))
    const nuevas = within(ficha).getAllByLabelText('Talla')
    await user.type(nuevas[nuevas.length - 1], 'L')
    await user.click(within(ficha).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PUT')).toBeTruthy())
    const put = llamadas.find((l) => l.metodo === 'PUT')!
    expect(put.url).toMatch(/\/tienda\/admin\/productos\/4$/)
    expect(put.cuerpo).toMatchObject({
      existencias: null,
      tallas: [{ id: 40, nombre: 'M', existencias: 8 }, { id: 41, nombre: 'XXL', existencias: 2 }, { nombre: 'L', existencias: null }],
    })
    expect(await screen.findByText('Producto guardado.')).toBeInTheDocument()
  })

  it('cambiar de producto con cambios sin guardar pregunta antes', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda' })
    const ficha = await screen.findByRole('region', { name: 'Ficha de Camiseta' })
    await user.type(within(ficha).getByLabelText('Nombre'), ' negra')
    await user.click(within(screen.getByRole('region', { name: 'Productos' })).getByRole('button', { name: /Estampa/ }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Descartar' }))
    expect(await screen.findByRole('region', { name: 'Ficha de Estampa' })).toBeInTheDocument()
  })

  it('dos tallas con el mismo nombre no se guardan', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda' })
    const ficha = await screen.findByRole('region', { name: 'Ficha de Camiseta' })
    await user.click(within(ficha).getByRole('button', { name: 'Añadir talla' }))
    const nuevas = within(ficha).getAllByLabelText('Talla')
    await user.type(nuevas[nuevas.length - 1], 'm')
    expect(within(ficha).getByText('Hay dos tallas con el mismo nombre.')).toBeInTheDocument()
    expect(within(ficha).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })
})
