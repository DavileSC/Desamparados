import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../../test/test-utils'
import NoticiasPage from '../NoticiasPage'
import NoticiaDetallePage from '../NoticiaDetallePage'

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

describe('NoticiasPage: la noticia destacada', () => {
  const otra = { ...noticia, id: 2, slug: 'cabildo', titulo: 'Cabildo general', fecha: '2026-08-01T10:00:00.000Z' }
  const servir = (page: number) => vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data: [noticia, otra], meta: { total: 45, page, limit: 20, totalPages: 3 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))))

  it('en la primera página, la más reciente va destacada y el resto no', async () => {
    servir(1)
    renderWithProviders(<NoticiasPage />)
    const primera = await screen.findByRole('link', { name: /triduo de septiembre/i })
    expect(primera).toHaveAttribute('data-destacada', 'true')
    expect(screen.getByRole('link', { name: /cabildo general/i })).not.toHaveAttribute('data-destacada')
  })

  it('en las páginas siguientes no hay destacada: la primera de la página 3 no es la última noticia', async () => {
    servir(3)
    renderWithProviders(<NoticiasPage />, { ruta: '/?pagina=3' })
    const primera = await screen.findByRole('link', { name: /triduo de septiembre/i })
    expect(primera).not.toHaveAttribute('data-destacada')
  })

  it('las placas sin foto no repiten tono con la de debajo en la rejilla de tres columnas', async () => {
    // Se rompe si el tono vuelve a ir por el índice a secas: cada columna salía
    // del mismo color fila tras fila.
    const sinFoto = Array.from({ length: 9 }, (_, i) => ({ ...noticia, id: 10 + i, slug: `n-${i}`, titulo: `Noticia ${i}` }))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: sinFoto, meta: { total: 45, page: 2, limit: 20, totalPages: 3 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<NoticiasPage />, { ruta: '/?pagina=2' })
    await screen.findByRole('link', { name: /noticia 0/i })

    const tonos = screen.getAllByTestId('placa-noticia').map((placa) => placa.getAttribute('data-tono'))
    tonos.forEach((tono, i) => {
      if (i + 3 < tonos.length) expect(tonos[i + 3]).not.toBe(tono)
      if (i % 3 < 2) expect(tonos[i + 1]).not.toBe(tono)
    })
  })

  it('el visitante no ve el selector de resultados por página', async () => {
    // Es una herramienta del CMS: en el archivo público solo estorba.
    servir(1)
    renderWithProviders(<NoticiasPage />)
    await screen.findByRole('link', { name: /triduo de septiembre/i })
    expect(screen.queryByLabelText(/resultados por página/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
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

describe('NoticiasPage: volver de una noticia no pierde la página', () => {
  it('desde la página 3 del archivo, «Volver a todas las noticias» devuelve a la página 3', async () => {
    // El enlace de la ficha apuntaba a `/actualidad/noticias` a secas, así que
    // el visitante que entraba en una noticia de la página 3 volvía a la 1.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: RequestInfo | URL) =>
      Promise.resolve(new Response(
        JSON.stringify(String(url).includes('/archive')
          ? { data: [noticia], meta: { total: 45, page: 3, limit: 20, totalPages: 3 } }
          : noticia),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))))
    const usuario = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/actualidad/noticias" element={<NoticiasPage />} />
        <Route path="/actualidad/noticias/:slug" element={<NoticiaDetallePage />} />
      </Routes>,
      { ruta: '/actualidad/noticias?pagina=3' },
    )

    await usuario.click(await screen.findByText(/triduo de septiembre/i))

    const volver = await screen.findByRole('link', { name: /volver a todas las noticias/i })
    expect(volver).toHaveAttribute('href', '/actualidad/noticias?pagina=3')
  })
})
