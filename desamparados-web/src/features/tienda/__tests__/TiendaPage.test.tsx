import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/test-utils'
import TiendaPage from '../TiendaPage'
import PedidoTiendaPage from '../PedidoTiendaPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const CAMISETA = {
  id: 3, nombre: 'Camiseta', descripcion: 'Negra, con el escudo', precio: 12, foto: '/uploads/camiseta.webp', fotos: [], existencias: null, activo: true, orden: 2,
  tallas: [{ id: 30, nombre: 'S', existencias: 3 }, { id: 31, nombre: 'L', existencias: 9 }, { id: 32, nombre: 'XXL', existencias: 0 }],
}
const CATALOGO = {
  pagoDisponible: true, metodos: ['TARJETA', 'BIZUM'],
  productos: [
    { id: 1, nombre: 'Medalla', descripcion: 'De plata', precio: 15, foto: null, fotos: [], existencias: 2, activo: true, orden: 0, tallas: [] },
    { id: 2, nombre: 'Estampa', descripcion: '', precio: 1.5, foto: null, fotos: [], existencias: 0, activo: true, orden: 1, tallas: [] },
    CAMISETA,
  ],
}

/** La tienda con sus rutas: la rejilla, la ficha y la vuelta del pedido. */
const montar = (ruta: string) => renderWithProviders(
  <Routes>
    <Route path="/tienda" element={<TiendaPage />} />
    <Route path="/tienda/producto/:id" element={<TiendaPage />} />
    <Route path="/tienda/pedido/:token" element={<p>Pantalla del pedido</p>} />
  </Routes>,
  { ruta },
)

/** El servidor: el catálogo, y los pedidos se dan por pagados en el acto. */
function servidor(catalogo: unknown = CATALOGO) {
  const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => Promise.resolve(
    init.method === 'POST' ? json({ tipo: 'hecho', token: 'a'.repeat(32) }, 201) : json(catalogo),
  ))
  vi.stubGlobal('fetch', fetch)
  return () => {
    const envio = fetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    return envio ? JSON.parse(String((envio[1] as RequestInit).body)) as Record<string, unknown> : null
  }
}

async function pagarComo(user: ReturnType<typeof userEvent.setup>, total: RegExp) {
  await user.click(screen.getByRole('button', { name: 'Seguir con el pago' }))
  const pagar = screen.getByRole('button', { name: total })
  expect(pagar).toBeDisabled()
  await user.type(screen.getByLabelText('Nombre y apellidos'), 'Ana Ruiz')
  await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo.es')
  await user.type(screen.getByLabelText('Teléfono'), '600111222')
  await user.click(pagar)
}

beforeEach(() => { try { window.localStorage.clear() } catch { /* sin almacenamiento */ } })
afterEach(() => { vi.unstubAllGlobals() })

describe('TiendaPage', () => {
  it('llena la cesta sin pasar de lo que queda y paga con los datos del comprador', async () => {
    const user = userEvent.setup()
    const enviado = servidor()
    montar('/tienda')

    expect(await screen.findByRole('link', { name: 'Medalla' })).toBeInTheDocument()
    expect(screen.getAllByText('Agotado').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(screen.getByRole('button', { name: 'En la cesta · 1' })).toBeInTheDocument()
    const cesta = screen.getByRole('complementary', { name: 'Tu cesta' })
    await user.click(within(cesta).getByRole('button', { name: 'Añadir una unidad de Medalla' }))
    expect(within(cesta).getByRole('button', { name: 'Añadir una unidad de Medalla' })).toBeDisabled()

    await pagarComo(user, /Pagar 30,00/)
    await waitFor(() => expect(enviado()).not.toBeNull())
    expect(enviado()).toEqual({ nombre: 'Ana Ruiz', email: 'ana@ejemplo.es', telefono: '600111222', metodo: 'TARJETA', lineas: [{ productoId: 1, cantidad: 2 }] })
    expect(await screen.findByText('Pantalla del pedido')).toBeInTheDocument()
  })

  it('en el móvil, un producto con tallas lleva a su ficha para elegirla', async () => {
    servidor()
    montar('/tienda')
    expect(await screen.findByRole('link', { name: 'Elegir talla' })).toHaveAttribute('href', '/tienda/producto/3')
    expect(screen.getByRole('link', { name: 'Ver Camiseta' })).toHaveAttribute('href', '/tienda/producto/3')
  })

  it('la ficha: se elige la talla (la agotada no), cuántas, y el pedido lleva la talla', async () => {
    const user = userEvent.setup()
    const enviado = servidor()
    montar('/tienda/producto/3')

    expect(await screen.findByRole('heading', { name: 'Camiseta', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Talla XXL, agotada' })).toBeDisabled()
    expect(screen.getByText(/Quedan 3 en la S\. La XXL, agotada\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Talla L' }))
    expect(screen.getByRole('button', { name: 'Talla L' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getAllByRole('button', { name: 'Añadir una unidad de Camiseta' })[0])
    await user.click(screen.getByRole('button', { name: /Añadir · 24,00/ }))

    const cesta = screen.getByRole('complementary', { name: 'Tu cesta' })
    expect(within(cesta).getByText(/Talla L/)).toBeInTheDocument()
    await pagarComo(user, /Pagar 24,00/)
    await waitFor(() => expect(enviado()).not.toBeNull())
    expect(enviado()?.lineas).toEqual([{ productoId: 3, tallaId: 31, cantidad: 2 }])
  })

  it('la ficha: la foto grande abre el visor con todas las fotos, y da la vuelta', async () => {
    const user = userEvent.setup()
    const medalla = { ...CATALOGO.productos[0], foto: '/uploads/medalla.webp', fotos: [{ url: '/uploads/reverso.webp', pie: 'El reverso' }, { url: '/uploads/caja.webp', pie: '' }] }
    servidor({ ...CATALOGO, productos: [medalla] })
    montar('/tienda/producto/1')

    await user.click(await screen.findByRole('button', { name: 'Ver la foto 2: El reverso' }))
    await user.click(screen.getByRole('button', { name: 'Ampliar la foto 2 de 3' }))
    const visor = await screen.findByRole('dialog')
    expect(await within(visor).findByText('El reverso')).toBeInTheDocument()
    // Pasada la última, vuelve a la primera (antes el visor se rompía).
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(within(screen.getByRole('dialog')).getByText('01')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(within(screen.getByRole('dialog')).getByText('03')).toBeInTheDocument()
  })

  it('un producto que ya no está dice que no está y lleva a la tienda', async () => {
    servidor()
    montar('/tienda/producto/99')
    expect(await screen.findByText('Ese producto ya no está a la venta.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver toda la tienda' })).toHaveAttribute('href', '/tienda')
  })

  it('una cesta guardada de antes pierde lo que ya no vale', async () => {
    // La medalla vale; la camiseta sin talla (de cuando no tenía tallas) y un producto borrado, no.
    window.localStorage.setItem('tienda-cesta', JSON.stringify({ 1: 1, 3: 2, 77: 1 }))
    servidor()
    montar('/tienda')
    const cesta = await screen.findByRole('complementary', { name: 'Tu cesta' })
    expect(within(cesta).getByText('Medalla')).toBeInTheDocument()
    expect(within(cesta).queryByText('Camiseta')).not.toBeInTheDocument()
    expect(within(cesta).getAllByRole('listitem')).toHaveLength(1)
  })

  it('sin pasarela enseña el catálogo y dice que se compra en Secretaría', async () => {
    servidor({ ...CATALOGO, pagoDisponible: false })
    montar('/tienda')
    expect(await screen.findByText(/se compran en Secretaría/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Tu cesta' })).not.toBeInTheDocument()
  })
})

describe('PedidoTiendaPage', () => {
  it('pagado, dice que se recoja en Secretaría, con la talla de lo que la tiene', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      numero: 7, estado: 'PAGADO', total: 42, nombre: 'Ana',
      lineas: [{ nombre: 'Medalla', talla: null, precio: 15, cantidad: 2 }, { nombre: 'Camiseta', talla: 'L', precio: 12, cantidad: 1 }],
    })))
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc' })
    expect(await screen.findByText(/Pedido pagado, Ana\. Recógelo en Secretaría/)).toBeInTheDocument()
    expect(screen.getByText('2 × Medalla')).toBeInTheDocument()
    expect(screen.getByText('1 × Camiseta (talla L)')).toBeInTheDocument()
  })

  it('si el banco dijo que no, lo dice y no espera', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ numero: 7, estado: 'PENDIENTE_PAGO', total: 30, nombre: 'Ana', lineas: [] })))
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc?resultado=no' })
    expect(await screen.findByText(/El pago no se ha completado/)).toBeInTheDocument()
  })
})
