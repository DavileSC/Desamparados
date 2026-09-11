import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AccountingAdminPage from '../AccountingAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

// mockImplementation, no mockResolvedValue: la pantalla lanza tres fetch a
// la vez (balance, libro mayor y categorías) con un `Promise.all`. Compartir
// una única instancia de Response rompería el segundo `.text()` con la
// Fetch API real (el cuerpo solo se puede leer una vez), y compartir un
// único cuerpo para las tres formas distintas rompería `categories.filter`
// en cuanto la respuesta del libro mayor le llegara a las categorías: se
// responde por URL, como en BrothersAdminPage.test.tsx.
function responder(totalMovimientos: number) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const cuerpo = String(url).includes('libro-mayor')
      ? { data: [], meta: { total: totalMovimientos, page: 1, limit: 20, totalPages: Math.ceil(totalMovimientos / 20) } }
      : String(url).includes('categorias') ? [] : { ingresos: 0, gastos: 0, balanceTotal: 0 }
    return Promise.resolve(new Response(
      JSON.stringify(cuerpo),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
  }))
}

describe('AccountingAdminPage', () => {
  it('dice cuántos movimientos hay en total', async () => {
    // 1.278 movimientos, de los que se veían 200.
    responder(1278)
    renderWithProviders(<AccountingAdminPage />)
    expect(await screen.findByText(/de 1278/i)).toBeInTheDocument()
  })

  it('al entrar se ven balance y libro mayor; apunte y categoría van cada uno en su ventana', async () => {
    const user = userEvent.setup()
    responder(3)
    renderWithProviders(<AccountingAdminPage />)

    expect(await screen.findByText(/3 resultados/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/concepto/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /nuevo apunte/i }))
    expect(screen.getByRole('dialog', { name: /nuevo apunte/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/concepto/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    // Con la ventana abierta, MUI esconde el resto de la pantalla a la accesibilidad.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
    expect(await screen.findByRole('dialog', { name: /nueva categoría/i })).toBeInTheDocument()
  })
})
