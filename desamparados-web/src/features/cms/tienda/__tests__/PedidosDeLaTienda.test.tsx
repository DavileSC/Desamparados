import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import TiendaAdminPage from '../../TiendaAdminPage'
import { useAuthStore, type AuthUser } from '../../../altas/auth/store'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const pedido = (id: number, estado: string, extra: Record<string, unknown> = {}) => ({
  id, numero: id, estado, total: 24, nombre: 'Ana', email: 'ana@ejemplo.es', telefono: '600000000', metodo: 'TARJETA',
  creadoEl: '2026-10-01T10:00:00.000Z', pagadoEl: estado === 'PENDIENTE_PAGO' ? null : '2026-10-01T10:05:00.000Z',
  entregadoEl: null, canceladoEl: null, pagoConIncidencia: false,
  lineas: [{ nombre: 'Taza', talla: null, precio: 12, cantidad: 2 }],
  ...extra,
})

/** Sin filtro, el servidor da también los cobrados con incidencia (y los anulados). */
function servidor(respuestaAnular: () => Response = () => json({ message: 'Pedido n.º 3 anulado: el reembolso queda apuntado en Contabilidad.' })) {
  const llamadas: { url: string; metodo: string }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const u = String(url)
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: u, metodo })
    if (u.endsWith('/anular') && metodo === 'POST') return Promise.resolve(respuestaAnular())
    if (u.includes('/tienda/admin/pedidos?estado=PAGADO')) return Promise.resolve(json([pedido(3, 'PAGADO')]))
    if (u.includes('/tienda/admin/pedidos?estado=CANCELADO')) return Promise.resolve(json([pedido(4, 'CANCELADO', { canceladoEl: '2026-10-02T09:00:00.000Z' })]))
    if (u.endsWith('/tienda/admin/pedidos')) return Promise.resolve(json([pedido(3, 'PAGADO'), pedido(5, 'PENDIENTE_PAGO', { pagoConIncidencia: true })]))
    return Promise.resolve(json([]))
  }))
  return llamadas
}

const cuenta = (role: string): AuthUser => ({ id: 1, email: 'junta@ejemplo.es', role, perfiles: [], origen: 'cms' })

// Anular un cobrado es de Tesorería (R5): las pruebas de siempre, con su rol.
beforeEach(() => { useAuthStore.setState({ status: 'listo', cms: cuenta('TESORERIA') }) })
afterEach(() => { vi.unstubAllGlobals() })

describe('TiendaAdminPage · pedidos', () => {
  it('«Anular pedido» pide confirmación en una ventana, avisa del reembolso y llama a anular', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=pedidos' })

    await user.click(await screen.findByRole('button', { name: 'Anular el pedido n.º 3' }))
    const ventana = screen.getByRole('dialog')
    expect(within(ventana).getByText(/vuelven las existencias/i)).toBeInTheDocument()
    expect(within(ventana).getByText(/gasto de 24,00\s€/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.url.endsWith('/anular'))).toBe(false)

    await user.click(within(ventana).getByRole('button', { name: 'Anular pedido' }))
    expect(await screen.findByText(/el reembolso queda apuntado en Contabilidad/i)).toBeInTheDocument()
    expect(llamadas.filter((l) => l.metodo === 'POST').map((l) => l.url)).toEqual([expect.stringMatching(/\/tienda\/admin\/pedidos\/3\/anular$/)])
  })

  it('tras anular vuelve a pedir los productos: el pedido cobrado devolvió sus existencias', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=pedidos' })
    const pedidasDeProductos = () => llamadas.filter((l) => l.url.endsWith('/tienda/admin/productos')).length

    await user.click(await screen.findByRole('button', { name: 'Anular el pedido n.º 3' }))
    await waitFor(() => expect(pedidasDeProductos()).toBe(1))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular pedido' }))
    await waitFor(() => expect(pedidasDeProductos()).toBe(2))
  })

  it('Secretaría no puede anular un pedido cobrado, pero sí uno cobrado sin completar', async () => {
    useAuthStore.setState({ cms: cuenta('SECRETARIA') })
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=pedidos' })

    expect(await screen.findByText('N.º 3 · Ana')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular el pedido n.º 3' })).not.toBeInTheDocument()
    // «Entregado» sigue siendo suyo.
    expect(screen.getByRole('button', { name: 'Entregado' })).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Pedidos' }))
    await user.click(await screen.findByRole('option', { name: 'Cobrados sin completar' }))
    expect(await screen.findByRole('button', { name: 'Anular el pedido n.º 5' })).toBeInTheDocument()
  })

  it('si el servidor responde que es cosa de Tesorería, enseña su motivo', async () => {
    const user = userEvent.setup()
    const motivo = 'Este pedido ya se cobró: anularlo apunta su reembolso en Contabilidad, y eso solo lo puede hacer Tesorería.'
    servidor(() => json({ error: motivo, soloTesoreria: true }, 403))
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=pedidos' })

    await user.click(await screen.findByRole('button', { name: 'Anular el pedido n.º 3' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular pedido' }))
    expect(await screen.findByText(motivo)).toBeInTheDocument()
  })

  it('si el servidor no deja anular, lo dice', async () => {
    const user = userEvent.setup()
    servidor(() => json({ message: 'Ese pedido ya estaba anulado.' }, 409))
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=pedidos' })

    await user.click(await screen.findByRole('button', { name: 'Anular el pedido n.º 3' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular pedido' }))
    expect(await screen.findByText('Ese pedido ya estaba anulado.')).toBeInTheDocument()
  })

  // Se agotó mientras se pagaba: antes quedaba escondido en «Sin pagar».
  it('los cobrados que no se completaron tienen su filtro, su marca y se pueden anular', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=pedidos' })

    await user.click(await screen.findByRole('combobox', { name: 'Pedidos' }))
    await user.click(await screen.findByRole('option', { name: 'Cobrados sin completar' }))
    expect(await screen.findByText('N.º 5 · Ana')).toBeInTheDocument()
    expect(screen.queryByText('N.º 3 · Ana')).not.toBeInTheDocument()
    expect(screen.getByText('Cobrado sin completar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Anular el pedido n.º 5' }))
    expect(within(screen.getByRole('dialog')).getByText(/resolver su incidencia en Tesorería/i)).toBeInTheDocument()
  })

  it('los anulados tienen su filtro y su fecha, y no ofrecen nada', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=pedidos' })

    await user.click(await screen.findByRole('combobox', { name: 'Pedidos' }))
    await user.click(await screen.findByRole('option', { name: 'Anulados' }))
    expect(await screen.findByText(/anulado el/i)).toBeInTheDocument()
    expect(screen.getByText('Anulado')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /anular el pedido/i })).not.toBeInTheDocument())
  })
})
