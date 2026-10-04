import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import TiendaAdminPage from '../../TiendaAdminPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const CATEGORIAS = ['Ropa', 'Medallas', 'Estampas', 'Rosarios', 'Velas'].map((nombre, i) => ({ id: i + 1, nombre, orden: i, productos: i === 0 ? 2 : 0 }))

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const u = String(url)
    const metodo = init.method ?? 'GET'
    const cuerpo = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    llamadas.push({ url: u, metodo, cuerpo })
    if (u.endsWith('/categorias') && metodo === 'POST') return Promise.resolve(json({ id: 9, nombre: cuerpo?.nombre, orden: 5, productos: 0 }, 201))
    if (u.includes('/categorias/') && metodo === 'DELETE') return Promise.resolve(json({ message: 'Categoría borrada. Sus productos siguen a la venta, sin categoría.' }))
    if (u.includes('/categorias')) return Promise.resolve(json(CATEGORIAS))
    return Promise.resolve(json([]))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('TiendaAdminPage · categorías', () => {
  it('crea, ordena y borra, y marca cuáles quedan dentro de «Más»', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<TiendaAdminPage />, { ruta: '/cms/tienda?vista=categorias' })

    const seccion = await screen.findByRole('region', { name: 'Categorías' })
    expect(await within(seccion).findByLabelText('Nombre de la categoría 1')).toHaveValue('Ropa')
    // Cinco: las tres primeras se ven siempre; Rosarios y Velas, en «Más».
    expect(within(seccion).getByText('Dentro de «Más»')).toBeInTheDocument()

    await user.type(within(seccion).getByLabelText('Nueva categoría'), 'Libros')
    await user.click(within(seccion).getByRole('button', { name: 'Añadir' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.url.endsWith('/tienda/admin/categorias'))).toBe(true))
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ nombre: 'Libros' })

    await user.click(within(seccion).getByRole('button', { name: 'Bajar Ropa' }))
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/categorias/orden'))?.cuerpo).toEqual({ ids: [2, 1, 3, 4, 5] }))
    expect(within(seccion).getByRole('button', { name: 'Subir Ropa' })).toBeDisabled()

    await user.click(within(seccion).getByRole('button', { name: 'Borrar Ropa' }))
    expect(screen.getByText(/Sus productos siguen a la venta, sin categoría\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE' && l.url.endsWith('/categorias/1'))).toBe(true))
  })
})
