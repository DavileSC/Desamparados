import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import VentaEnMano from '../VentaEnMano'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const MEDALLA = { id: 1, nombre: 'Medalla', descripcion: '', precio: 15, foto: null, fotos: [], existencias: 2, activo: true, orden: 0, tallas: [] }
const CAMISETA = {
  id: 4, nombre: 'Camiseta', descripcion: '', precio: 12, foto: null, fotos: [], existencias: null, activo: true, orden: 1,
  tallas: [{ id: 40, nombre: 'M', existencias: 1 }, { id: 41, nombre: 'XXL', existencias: 0 }],
}
const VACIO = { efectivoPorIngresar: 0, ventas: [], ingresos: [] }
const VENDIDA = {
  id: 3, total: 35.5, metodo: 'EFECTIVO', vendidaEl: '2026-10-02T10:00:00.000Z', vendedor: 'Ana', anuladaEl: null, anuladaPor: null, anulable: true,
  lineas: [{ productoId: 1, nombre: 'Medalla', talla: null, precio: 15, cantidad: 2 }, { productoId: null, nombre: 'Libro usado', talla: null, precio: 5.5, cantidad: 1 }],
}
const CON_EFECTIVO = { efectivoPorIngresar: 35.5, ventas: [VENDIDA], ingresos: [] }

function servidor(estado: unknown) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const u = String(url)
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: u, metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (u.endsWith('/tienda/admin/productos')) return Promise.resolve(json([MEDALLA, CAMISETA]))
    if (u.endsWith('/caja/ventas')) return Promise.resolve(json({ ventaId: 3, total: 35.5, estado: CON_EFECTIVO }))
    if (u.endsWith('/caja/ingresos')) return Promise.resolve(json({ ...CON_EFECTIVO, efectivoPorIngresar: 5.5, ingresos: [{ id: 9, fecha: '2026-10-02', importe: 30, nota: null, apuntadoPor: 'Ana' }] }))
    return Promise.resolve(json(estado))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('VentaEnMano', () => {
  it('sin caja que abrir: se pulsa lo que se lleva, se dice cómo pagó y queda apuntado', async () => {
    const user = userEvent.setup()
    const llamadas = servidor(VACIO)
    renderWithProviders(<VentaEnMano />)
    const medalla = await screen.findByRole('button', { name: /Medalla/ })
    expect(screen.queryByText(/Fondo inicial/)).not.toBeInTheDocument()
    await user.click(medalla)
    await user.click(medalla)
    // Solo quedan dos: la tercera no se puede pulsar.
    expect(medalla).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Otra cosa/ }))
    await user.type(screen.getByLabelText('Qué es'), 'Libro usado')
    await user.type(screen.getByLabelText('Precio (€)'), '5,50')
    await user.click(screen.getByRole('button', { name: 'Añadir a la venta' }))
    // Hasta que el diálogo acaba de cerrarse, MUI deja el resto en aria-hidden (notas §6).
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('Total de la venta')).toHaveTextContent('35,50'))
    await user.click(screen.getByRole('button', { name: 'Efectivo' }))
    expect(await screen.findByText(/Venta n.º 3 apuntada: 35,50\s€ en efectivo\. Queda por ingresar en el banco\./)).toBeInTheDocument()
    expect(llamadas.find((l) => l.url.endsWith('/caja/ventas'))?.cuerpo).toEqual({
      lineas: [{ productoId: 1, cantidad: 2 }, { nombre: 'Libro usado', centimos: 550, cantidad: 1 }], metodo: 'EFECTIVO',
    })
    expect(screen.getByText(/Efectivo por ingresar en el banco: 35,50/)).toBeInTheDocument()
  })

  it('un producto con tallas se vende eligiendo la talla, sin pasar de lo que queda de ella', async () => {
    const user = userEvent.setup()
    const llamadas = servidor(VACIO)
    renderWithProviders(<VentaEnMano />)
    const camiseta = await screen.findByRole('button', { name: /Camiseta/ })
    await user.click(camiseta)
    const menu = await screen.findByRole('menu', { name: 'Talla de Camiseta' })
    expect(within(menu).getByRole('menuitem', { name: /Talla XXL/ })).toHaveAttribute('aria-disabled', 'true')
    await user.click(within(menu).getByRole('menuitem', { name: /Talla M/ }))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(screen.getByText('Camiseta (talla M)')).toBeInTheDocument()
    // De la M quedaba una y la XXL está agotada: ya no hay talla que vender.
    expect(camiseta).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Bizum' }))
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/caja/ventas'))?.cuerpo).toEqual({
      lineas: [{ productoId: 4, tallaId: 40, cantidad: 1 }], metodo: 'BIZUM',
    }))
  })

  it('el efectivo se apunta al llevarlo al banco, sin pasar de lo que queda por ingresar', async () => {
    const user = userEvent.setup()
    const llamadas = servidor(CON_EFECTIVO)
    renderWithProviders(<VentaEnMano />)
    expect(await screen.findByText(/Efectivo por ingresar en el banco: 35,50/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apuntar ingreso en el banco' }))
    const dialogo = await screen.findByRole('dialog')
    const importe = within(dialogo).getByLabelText('Importe ingresado (€)')
    expect(importe).toHaveValue('35,50')
    await user.clear(importe)
    await user.type(importe, '40')
    expect(within(dialogo).getByText(/No puede pasar de 35,50/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Apuntar el ingreso' })).toBeDisabled()
    await user.clear(importe)
    await user.type(importe, '30')
    await user.type(within(dialogo).getByLabelText('Nota (opcional)'), 'Ingreso del viernes')
    await user.click(within(dialogo).getByRole('button', { name: 'Apuntar el ingreso' }))
    expect(await screen.findByText(/Apuntado: 30,00\s€ ingresados en el banco\./)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const envio = llamadas.find((l) => l.url.endsWith('/caja/ingresos'))?.cuerpo as { fecha: string; importe: number; nota: string }
    expect(envio).toMatchObject({ importe: 30, nota: 'Ingreso del viernes' })
    expect(envio.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(screen.getByText(/Efectivo por ingresar en el banco: 5,50/)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Ingresado en el banco' })).getByText(/30,00\s€ ingresados en el banco/)).toBeInTheDocument()
  })
})
