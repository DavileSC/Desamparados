import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import HistoricoPage from '../HistoricoPage'

const papeleta = {
  id: 3,
  year: 2026,
  puesto: 'Cirio',
  tramo: 'Tramo 3 Virgen',
  numero: null,
  hermano: { nombre: 'Ana', apellidos: 'Pérez Ruiz' },
  recibo: { estado: 'PAGADO', importe: 30 },
}

/**
 * Una instancia de `Response` por llamada: `llamarApi` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
function responder(data: unknown[], meta: Record<string, number>) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('HistoricoPage', () => {
  it('pinta las papeletas que llegan en data y ofrece pasar de página', async () => {
    const simulado = responder([papeleta], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<HistoricoPage />)

    expect(await screen.findByText(/tramo 3 virgen/i)).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/procesion/mis-papeletas?')
  })

  it('dice cuántas papeletas hay en total, no cuántas se ven', async () => {
    responder([papeleta], { total: 45, page: 1, limit: 20, totalPages: 3 })
    renderWithProviders(<HistoricoPage />)

    expect(await screen.findByText(/de 45/i)).toBeInTheDocument()
  })

  it('una papeleta exenta (0 €) está asignada; una devuelta, no', async () => {
    // Con el precio a 0 € la papeleta nace con su recibo EXENTO: el sitio es
    // del hermano igual que si la hubiera pagado. Antes salía «No disponible».
    responder([
      { ...papeleta, id: 4, tramo: 'Tramo exento', recibo: { estado: 'EXENTO', importe: 0 } },
      { ...papeleta, id: 5, tramo: 'Tramo devuelto', recibo: { estado: 'DEVUELTO', importe: 30 } },
    ], { total: 2, page: 1, limit: 20, totalPages: 1 })
    renderWithProviders(<HistoricoPage />)

    const exenta = (await screen.findByText('Tramo exento')).closest('tr') as HTMLElement
    expect(within(exenta).getByText('Asignada')).toBeInTheDocument()
    const devuelta = screen.getByText('Tramo devuelto').closest('tr') as HTMLElement
    expect(within(devuelta).getByText('No disponible')).toBeInTheDocument()
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 45, page: 2, limit: 20, totalPages: 3 })
    renderWithProviders(<HistoricoPage />, { ruta: '/area-hermano/procesion/historico?pagina=2' })

    await waitFor(() => expect(String(simulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
