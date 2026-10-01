import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import Caja from '../Caja'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const MEDALLA = { id: 1, nombre: 'Medalla', descripcion: '', precio: 15, foto: null, existencias: 2, activo: true, orden: 0 }
const RESUMEN = { ventas: 0, anuladas: 0, total: 0, porMetodo: { EFECTIVO: 0, TARJETA: 0, BIZUM: 0 } }
const ABIERTA = {
  id: 7, abiertaEl: '2026-10-02T09:00:00.000Z', abiertaPor: 'Ana Ruiz', fondoInicial: 50, cerradaEl: null, cerradaPor: null,
  efectivoEsperado: 50, efectivoContado: null, observaciones: null, resumen: RESUMEN, ventas: [],
}
const VENDIDA = {
  ...ABIERTA, efectivoEsperado: 85.5, resumen: { ...RESUMEN, ventas: 1, total: 35.5, porMetodo: { EFECTIVO: 35.5, TARJETA: 0, BIZUM: 0 } },
  ventas: [{ id: 3, total: 35.5, metodo: 'EFECTIVO', vendidaEl: '2026-10-02T10:00:00.000Z', vendedor: 'Ana', anuladaEl: null, anuladaPor: null, lineas: [{ productoId: 1, nombre: 'Medalla', precio: 15, cantidad: 2 }, { productoId: null, nombre: 'Libro usado', precio: 5.5, cantidad: 1 }] }],
}

function servidor(estado: unknown) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const u = String(url)
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: u, metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (u.endsWith('/tienda/admin/productos')) return Promise.resolve(json([MEDALLA]))
    if (u.endsWith('/caja/abrir')) return Promise.resolve(json({ abierta: ABIERTA, cerradas: [] }))
    if (u.endsWith('/caja/ventas')) return Promise.resolve(json({ ventaId: 3, total: 35.5, estado: { abierta: VENDIDA, cerradas: [] } }))
    if (u.endsWith('/caja/cerrar')) return Promise.resolve(json({ diferencia: -0.5, estado: { abierta: null, cerradas: [{ ...VENDIDA, cerradaEl: '2026-10-02T20:00:00.000Z', efectivoContado: 85, ventas: [] }] } }))
    return Promise.resolve(json(estado))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('Caja', () => {
  it('se abre con el fondo', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ abierta: null, cerradas: [] })
    renderWithProviders(<Caja />)
    await user.type(await screen.findByLabelText('Fondo inicial (€)'), '50')
    await user.click(screen.getByRole('button', { name: 'Abrir la caja' }))
    expect(await screen.findByText(/con 50,00\s€ de fondo/)).toBeInTheDocument()
    expect(llamadas.find((l) => l.url.endsWith('/caja/abrir'))?.cuerpo).toEqual({ fondoInicial: 50 })
  })

  it('vende del catálogo y suelto, calcula el cambio y cobra en efectivo', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ abierta: ABIERTA, cerradas: [] })
    renderWithProviders(<Caja />)
    const medalla = await screen.findByRole('button', { name: /Medalla/ })
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
    await user.type(screen.getByLabelText('Entrega en efectivo (€)'), '40')
    expect(screen.getByText(/Cambio: 4,50/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Efectivo' }))
    expect(await screen.findByText(/Venta n.º 3 cobrada: 35,50\s€ \(efectivo\). Cambio: 4,50/)).toBeInTheDocument()
    expect(llamadas.find((l) => l.url.endsWith('/caja/ventas'))?.cuerpo).toEqual({
      lineas: [{ productoId: 1, cantidad: 2 }, { nombre: 'Libro usado', centimos: 550, cantidad: 1 }], metodo: 'EFECTIVO',
    })
  })

  it('se cierra contando el efectivo y dice el descuadre', async () => {
    const user = userEvent.setup()
    servidor({ abierta: VENDIDA, cerradas: [] })
    renderWithProviders(<Caja />)
    await user.click(await screen.findByRole('button', { name: 'Cerrar la caja' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/85,50\s€/)).toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Efectivo contado (€)'), '85')
    expect(within(dialogo).getByText(/Faltan 0,50/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Cerrar la caja' }))
    expect(await screen.findByText(/descuadre de -0,50\s€ \(falta\)/)).toBeInTheDocument()
    expect(screen.getByText('Faltan 0,50 €')).toBeInTheDocument()
  })
})
