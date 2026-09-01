import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import NoticiasPage from '../NoticiasPage'

// El stub de IntersectionObserver que AnimatedSection necesita vive en
// src/test/setup.ts: lo comparten todas las páginas públicas con test.

afterEach(() => { vi.unstubAllGlobals() })

describe('NoticiasPage', () => {
  it('ofrece pasar de página cuando hay más noticias de las que caben', async () => {
    // El archivo público servía diez y no lo decía.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [], meta: { total: 45, page: 1, limit: 20, totalPages: 3 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<NoticiasPage />)
    expect(await screen.findByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
  })
})
