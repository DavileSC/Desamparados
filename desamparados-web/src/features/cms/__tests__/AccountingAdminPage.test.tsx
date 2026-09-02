import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import AccountingAdminPage from '../AccountingAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

describe('AccountingAdminPage', () => {
  it('dice cuántos movimientos hay en total', async () => {
    // 1.278 movimientos, de los que se veían 200.
    // mockImplementation, no mockResolvedValue: la pantalla lanza tres fetch a
    // la vez (balance, libro mayor y categorías) con un `Promise.all`. Compartir
    // una única instancia de Response rompería el segundo `.text()` con la
    // Fetch API real (el cuerpo solo se puede leer una vez), y compartir un
    // único cuerpo para las tres formas distintas rompería `categories.filter`
    // en cuanto la respuesta del libro mayor le llegara a las categorías: se
    // responde por URL, como en BrothersAdminPage.test.tsx.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const cuerpo = String(url).includes('libro-mayor')
        ? { data: [], meta: { total: 1278, page: 1, limit: 20, totalPages: 64 } }
        : String(url).includes('categorias') ? [] : { ingresos: 0, gastos: 0, balanceTotal: 0 }
      return Promise.resolve(new Response(
        JSON.stringify(cuerpo),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    }))
    renderWithProviders(<AccountingAdminPage />)
    expect(await screen.findByText(/de 1278/i)).toBeInTheDocument()
  })
})
