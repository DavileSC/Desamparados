import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { renderWithProviders } from '../../../test/test-utils'
import PaginaDeBloquesPublica from '../PaginaDeBloquesPublica'

afterEach(() => { vi.unstubAllGlobals() })

describe('PaginaDeBloquesPublica', () => {
  // Con la API caída, la cabecera a sangre se quedaba en huesos sin ningún
  // encabezado: el lector de pantalla no sabía en qué página estaba.
  it('si la página no carga, su título del catálogo sigue siendo el h1, sobre la banda quieta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Caído' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    renderWithProviders(<HelmetProvider><PaginaDeBloquesPublica slug="parroquia" /></HelmetProvider>, { ruta: '/parroquia' })

    expect(await screen.findByRole('button', { name: /volver a intentar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Parroquia' })).toBeInTheDocument()
  })
})
