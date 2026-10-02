import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import TiendaPage from '../TiendaPage'
import PedidoTiendaPage from '../PedidoTiendaPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const CATALOGO = {
  pagoDisponible: true, metodos: ['TARJETA', 'BIZUM'],
  productos: [
    { id: 1, nombre: 'Medalla', descripcion: 'De plata', precio: 15, foto: null, fotos: [], existencias: 2, activo: true, orden: 0 },
    { id: 2, nombre: 'Estampa', descripcion: '', precio: 1.5, foto: null, fotos: [], existencias: 0, activo: true, orden: 1 },
  ],
}

beforeEach(() => { try { window.localStorage.clear() } catch { /* sin almacenamiento */ } })
afterEach(() => { vi.unstubAllGlobals() })

describe('TiendaPage', () => {
  it('pulsar la foto de un producto abre la galería con todas sus fotos', async () => {
    const user = userEvent.setup()
    const medalla = { ...CATALOGO.productos[0], foto: '/uploads/medalla.webp', fotos: [{ url: '/uploads/reverso.webp', pie: 'El reverso' }, { url: '/uploads/caja.webp', pie: '' }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...CATALOGO, productos: [medalla, CATALOGO.productos[1]] })))
    renderWithProviders(<TiendaPage />, { ruta: '/tienda' })

    await user.click(await screen.findByRole('button', { name: 'Ver las 3 fotos de Medalla' }))
    const visor = await screen.findByRole('dialog')
    expect(within(visor).getAllByRole('img', { name: 'Medalla' }).length).toBeGreaterThan(0)
    await user.keyboard('{ArrowRight}')
    expect(await within(visor).findByText('El reverso')).toBeInTheDocument()
    // Sin foto, no hay nada que ampliar.
    expect(screen.queryByRole('button', { name: /fotos de Estampa|foto de Estampa/ })).not.toBeInTheDocument()
  })

  it('llena la cesta sin pasar de lo que queda y paga con los datos del comprador', async () => {
    const user = userEvent.setup()
    const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => Promise.resolve(
      init.method === 'POST' ? json({ tipo: 'hecho', token: 'a'.repeat(32) }, 201) : json(CATALOGO),
    ))
    vi.stubGlobal('fetch', fetch)
    renderWithProviders(<TiendaPage />, { ruta: '/tienda' })

    expect(await screen.findByText('Medalla')).toBeInTheDocument()
    expect(screen.getByText('Agotado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Añadir' }))
    await user.click(screen.getByRole('button', { name: 'Añadir una unidad de Medalla' }))
    expect(screen.getByRole('button', { name: 'Añadir una unidad de Medalla' })).toBeDisabled()
    expect(screen.getByText('2 × Medalla')).toBeInTheDocument()

    const pagar = screen.getByRole('button', { name: /Pagar 30,00/ })
    expect(pagar).toBeDisabled()
    await user.type(screen.getByLabelText('Nombre y apellidos'), 'Ana Ruiz')
    await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo.es')
    await user.type(screen.getByLabelText('Teléfono'), '600111222')
    await user.click(pagar)

    await waitFor(() => expect(fetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(true))
    const envio = fetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    expect(JSON.parse(String((envio[1] as RequestInit).body))).toEqual({ nombre: 'Ana Ruiz', email: 'ana@ejemplo.es', telefono: '600111222', metodo: 'TARJETA', lineas: [{ productoId: 1, cantidad: 2 }] })
  })

  it('sin pasarela enseña el catálogo y dice que se compra en Secretaría', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...CATALOGO, pagoDisponible: false })))
    renderWithProviders(<TiendaPage />, { ruta: '/tienda' })
    expect(await screen.findByText(/se compran en Secretaría/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
  })
})

describe('PedidoTiendaPage', () => {
  it('pagado, dice que se recoja en Secretaría', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ numero: 7, estado: 'PAGADO', total: 30, nombre: 'Ana', lineas: [{ nombre: 'Medalla', precio: 15, cantidad: 2 }] })))
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc' })
    expect(await screen.findByText(/Pedido pagado, Ana\. Recógelo en Secretaría/)).toBeInTheDocument()
    expect(screen.getByText('2 × Medalla')).toBeInTheDocument()
  })

  it('si el banco dijo que no, lo dice y no espera', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ numero: 7, estado: 'PENDIENTE_PAGO', total: 30, nombre: 'Ana', lineas: [] })))
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc?resultado=no' })
    expect(await screen.findByText(/El pago no se ha completado/)).toBeInTheDocument()
  })
})
