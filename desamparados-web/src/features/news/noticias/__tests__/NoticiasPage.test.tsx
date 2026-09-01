import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import NoticiasPage from '../NoticiasPage'

// AnimatedSection (framer-motion) observa la sección con IntersectionObserver,
// que jsdom no implementa. Sin este stub, cualquier página pública que use
// AnimatedSection revienta al montar en el test, antes de llegar al `expect`.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => { vi.unstubAllGlobals() })

describe('NoticiasPage', () => {
  it('ofrece pasar de página cuando hay más noticias de las que caben', async () => {
    // El archivo público servía diez y no lo decía.
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 45, page: 1, limit: 20, totalPages: 3 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    renderWithProviders(<NoticiasPage />)
    expect(await screen.findByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
  })
})
