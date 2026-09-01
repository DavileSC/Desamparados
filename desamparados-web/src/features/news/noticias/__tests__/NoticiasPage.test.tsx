import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import NoticiasPage from '../NoticiasPage'

// El stub de IntersectionObserver que AnimatedSection necesita vive en
// src/test/setup.ts: lo comparten todas las páginas públicas con test.

const noticia = {
  id: 1, slug: 'triduo-2026', titulo: 'Triduo de septiembre', extracto: 'Tres días de culto',
  contenido: 'Contenido de la noticia', imagenUrl: null, fecha: '2026-09-10T10:00:00.000Z', visible: true,
}

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

describe('NoticiasPage: el error de una página no se queda pegado', () => {
  it('vuelve a pintar las noticias cuando la siguiente carga va bien', async () => {
    // Esta pantalla llevaba su propio bloque de carga, anterior al hook, y con
    // él el fallo que el hook ya arreglaba: el `setError` del .catch no se
    // limpiaba nunca en el éxito y la rejilla está condicionada a !error, así
    // que un tropiezo pasajero al pasar de página dejaba al visitante con el
    // paginador, una alerta y ni una noticia hasta recargar a mano.
    vi.stubGlobal('scrollTo', vi.fn()) // jsdom no implementa el scroll suave
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: RequestInfo | URL) =>
      Promise.resolve(String(url).includes('page=2')
        ? new Response(JSON.stringify({ message: 'El archivo de noticias no responde.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
        : new Response(
          JSON.stringify({ data: [noticia], meta: { total: 45, page: 1, limit: 20, totalPages: 3 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ))))
    const usuario = userEvent.setup()
    renderWithProviders(<NoticiasPage />)

    expect(await screen.findByText(/triduo de septiembre/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /ir a la página 2/i }))
    expect(await screen.findByText(/el archivo de noticias no responde/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /ir a la página 1/i }))
    expect(await screen.findByText(/triduo de septiembre/i)).toBeInTheDocument()
    expect(screen.queryByText(/el archivo de noticias no responde/i)).not.toBeInTheDocument()
  })
})
