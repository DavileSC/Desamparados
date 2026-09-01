import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import InventoryAdminPage from '../InventoryAdminPage'

const enser = {
  id: 4, nombre: 'Ciriales', referencia: 'CIR-01', categoria: 'Cortejo', ubicacion: 'Sacristía',
  cantidadOptimo: 4, cantidadBueno: 2, cantidadReparar: 0, cantidadTotal: 6,
}
const prenda = {
  id: 9, numero: 'TUN-002', tipo: 'TUNICA', talla: '1.80m',
  estado: 'DISPONIBLE', observaciones: null, hermano: null,
}

afterEach(() => { vi.unstubAllGlobals() })

describe('InventoryAdminPage', () => {
  it('cada listado pasa página por su cuenta', async () => {
    // Con un solo parámetro compartido, pasar página en enseres movería el ropero.
    const user = userEvent.setup()
    // Una instancia de Response por llamada: `apiFetch` lee el cuerpo con
    // `res.text()` y la pantalla hace dos peticiones, una por listado.
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [], meta: { total: 120, page: 1, limit: 20, totalPages: 6 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    await user.click((await screen.findAllByRole('button', { name: /ir a la página 2/i }))[0])

    await waitFor(() => {
      const enseres = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/enseres'))
      const prendas = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/prendas'))
      expect(enseres.at(-1)).toContain('page=2')
      expect(prendas.every((url) => !url.includes('page=2'))).toBe(true)
    })
  })

  it('pinta los dos listados con lo que llega en data', async () => {
    const user = userEvent.setup()
    // Cada extremo responde lo suyo: la llamada se distingue por su URL, nunca
    // por su posición en mock.calls.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
      JSON.stringify({
        data: [String(url).includes('/enseres') ? enser : prenda],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    expect(await screen.findByRole('link', { name: /editar ciriales/i })).toHaveAttribute('href', '/cms/inventario/4/editar')

    await user.click(screen.getByRole('tab', { name: 'Ropero' }))

    expect(await screen.findByRole('link', { name: /editar tun-002/i })).toHaveAttribute('href', '/cms/inventario/9/editar?tipo=prenda')
  })
})
