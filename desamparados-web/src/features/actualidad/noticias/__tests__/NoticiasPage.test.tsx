import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../../test/test-utils'
import NoticiasPage from '../NoticiasPage'
import NoticiaDetallePage from '../NoticiaDetallePage'
import { stubFetchPublico } from '../../../../test/fetchPublico'

// El stub de IntersectionObserver que SeccionAnimada necesita vive en
// src/test/setup.ts: lo comparten todas las páginas públicas con test.

const noticia = {
  id: 1, slug: 'triduo-2026', titulo: 'Triduo de septiembre', extracto: 'Tres días de culto',
  contenido: 'Contenido de la noticia', imagenUrl: null as string | null,
  encuadreX: null as number | null, encuadreY: null as number | null,
  fecha: '2026-09-10T10:00:00.000Z', visible: true,
}

/** `cuantas` noticias, de la más reciente a la más antigua: «Noticia 1», «Noticia 2»… */
const archivo = (cuantas: number) => Array.from({ length: cuantas }, (_, i) => ({
  ...noticia, id: i + 1, slug: `noticia-${i + 1}`, titulo: `Noticia ${i + 1}`,
}))

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * El archivo como lo sirve la API: corta por `page` y `limit`. `falla` decide,
 * por la dirección pedida, si esa petición da error.
 */
function servirArchivo(noticias: typeof noticia[], falla: (url: string) => boolean = () => false) {
  const fetch = vi.fn().mockImplementation((entrada: RequestInfo | URL) => {
    const url = String(entrada)
    if (!url.includes('/archive')) return Promise.resolve(json(noticias.find((n) => url.endsWith(n.slug)) ?? noticia))
    if (falla(url)) return Promise.resolve(json({ message: 'El archivo de noticias no responde.' }, 500))
    const params = new URL(url, 'http://localhost').searchParams
    const page = Number(params.get('page')), limit = Number(params.get('limit'))
    return Promise.resolve(json({
      data: noticias.slice((page - 1) * limit, page * limit),
      meta: { total: noticias.length, page, limit, totalPages: Math.ceil(noticias.length / limit) },
    }))
  })
  stubFetchPublico(fetch)
  return fetch
}

/** Las noticias a la vista: la principal y las de las dos columnas, cada una un enlace. */
const tarjetas = () => within(screen.getByRole('list', { name: /^noticias$/i })).getAllByRole('link')

afterEach(() => { vi.unstubAllGlobals() })

describe('NoticiasPage: «Cargar más» en vez de paginador', () => {
  // Once (la principal y cinco filas de dos) y de diez en diez: con diez y de
  // nueve en nueve, la última fila de las dos columnas quedaba con una sola.
  it('enseña once y va cargando de diez en diez hasta que no quedan', async () => {
    servirArchivo(archivo(25))
    const usuario = userEvent.setup()
    renderWithProviders(<NoticiasPage />)

    expect(await screen.findByRole('link', { name: /noticia 11\b/i })).toBeInTheDocument()
    expect(tarjetas()).toHaveLength(11)

    await usuario.click(screen.getByRole('button', { name: /cargar más noticias/i }))
    expect(await screen.findByRole('link', { name: /noticia 21\b/i })).toBeInTheDocument()
    expect(tarjetas()).toHaveLength(21)

    await usuario.click(screen.getByRole('button', { name: /cargar más noticias/i }))
    expect(await screen.findByRole('link', { name: /noticia 25\b/i })).toBeInTheDocument()
    expect(tarjetas()).toHaveLength(25)
    expect(screen.queryByRole('button', { name: /cargar más/i })).not.toBeInTheDocument()
  })

  it('sin más noticias de las que caben, no hay botón', async () => {
    servirArchivo(archivo(4))
    renderWithProviders(<NoticiasPage />)
    await screen.findByRole('link', { name: /noticia 4\b/i })
    expect(screen.queryByRole('button', { name: /cargar más/i })).not.toBeInTheDocument()
  })

  it('no queda nada del paginador ni del selector de resultados por página', async () => {
    servirArchivo(archivo(25))
    renderWithProviders(<NoticiasPage />)
    await screen.findByRole('link', { name: /noticia 1\b/i })
    expect(screen.queryByRole('button', { name: /ir a la página/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/resultados por página/i)).not.toBeInTheDocument()
  })
})

describe('NoticiasPage: la principal y las dos columnas', () => {
  it('la más reciente va de principal y solo ella, también tras cargar más', async () => {
    servirArchivo(archivo(25))
    const usuario = userEvent.setup()
    renderWithProviders(<NoticiasPage />)
    expect(await screen.findByRole('link', { name: /noticia 1\b/i })).toHaveAttribute('data-principal')
    expect(screen.getByRole('link', { name: /noticia 2\b/i })).not.toHaveAttribute('data-principal')
    expect(within(screen.getByRole('list', { name: /más noticias/i })).getAllByRole('link')).toHaveLength(10)

    await usuario.click(screen.getByRole('button', { name: /cargar más noticias/i }))
    await screen.findByRole('link', { name: /noticia 21\b/i })
    expect(screen.getAllByRole('link').filter((enlace) => enlace.hasAttribute('data-principal'))).toHaveLength(1)
  })

  it('las de antes, sin foto, llevan el escudo de reserva y no un hueco', async () => {
    servirArchivo(archivo(4))
    renderWithProviders(<NoticiasPage />)
    await screen.findByRole('link', { name: /noticia 4\b/i })
    expect(screen.getAllByTestId('placa-noticia')).toHaveLength(4)
  })

  it('la foto se recorta por el punto de encuadre que se eligió en el CMS', async () => {
    servirArchivo([{ ...noticia, imagenUrl: '/storage/public/triduo.webp', encuadreX: 30, encuadreY: 20 }])
    renderWithProviders(<NoticiasPage />)
    const principal = await screen.findByRole('link', { name: /triduo de septiembre/i })
    const foto = principal.querySelector('img')
    expect(foto).not.toBeNull()
    expect(foto).toHaveStyle({ objectPosition: '30% 20%' })
    expect(screen.queryByTestId('placa-noticia')).not.toBeInTheDocument()
  })
})

describe('NoticiasPage: si falla al cargar más', () => {
  it('se quedan las ya cargadas, avisa y deja volver a intentarlo', async () => {
    let fallar = true
    servirArchivo(archivo(25), (url) => fallar && url.includes('limit=10'))
    const usuario = userEvent.setup()
    renderWithProviders(<NoticiasPage />)

    await screen.findByRole('link', { name: /noticia 11\b/i })
    await usuario.click(screen.getByRole('button', { name: /cargar más noticias/i }))

    expect(await screen.findByText(/el archivo de noticias no responde/i)).toBeInTheDocument()
    expect(tarjetas()).toHaveLength(11)

    fallar = false
    await usuario.click(screen.getByRole('button', { name: /volver a intentarlo/i }))
    expect(await screen.findByRole('link', { name: /noticia 21\b/i })).toBeInTheDocument()
    expect(screen.queryByText(/el archivo de noticias no responde/i)).not.toBeInTheDocument()
  })
})

describe('NoticiasPage: volver de una noticia no pierde lo cargado', () => {
  it('con veintiuna a la vista, «Volver a todas las noticias» vuelve con las veintiuna', async () => {
    servirArchivo(archivo(25))
    const usuario = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/noticias" element={<NoticiasPage />} />
        <Route path="/noticias/:slug" element={<NoticiaDetallePage />} />
      </Routes>,
      { ruta: '/noticias' },
    )

    await screen.findByRole('link', { name: /noticia 11\b/i })
    await usuario.click(screen.getByRole('button', { name: /cargar más noticias/i }))
    await usuario.click(await screen.findByRole('link', { name: /noticia 21\b/i }))

    const volver = await screen.findByRole('link', { name: /volver a todas las noticias/i })
    expect(volver).toHaveAttribute('href', '/noticias?mostrar=21')
  })

  // FR9 de la auditoría del 07-10-2026: lo cargado vivía en el estado del
  // componente y volver lo pedía todo otra vez desde la primera página, con
  // el esqueleto delante. Aquí el servidor deja de contestar al volver: si la
  // lista sale igual, es que viene de la caché.
  it('al volver, las veintiuna salen de la caché sin esperar al servidor', async () => {
    const simulado = servirArchivo(archivo(25))
    const usuario = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/noticias" element={<NoticiasPage />} />
        <Route path="/noticias/:slug" element={<NoticiaDetallePage />} />
      </Routes>,
      { ruta: '/noticias' },
    )

    await screen.findByRole('link', { name: /noticia 11\b/i })
    await usuario.click(screen.getByRole('button', { name: /cargar más noticias/i }))
    await usuario.click(await screen.findByRole('link', { name: /noticia 21\b/i }))
    const volver = await screen.findByRole('link', { name: /volver a todas las noticias/i })

    const respuestaAnterior = simulado.getMockImplementation()!
    simulado.mockImplementation((entrada: RequestInfo | URL) =>
      String(entrada).includes('/archive') ? new Promise(() => {}) : respuestaAnterior(entrada))
    await usuario.click(volver)

    expect(await screen.findByRole('link', { name: /noticia 21\b/i })).toBeInTheDocument()
    expect(tarjetas()).toHaveLength(21)
  })

  it('una dirección con ?mostrar=21 abre ya con veintiuna', async () => {
    servirArchivo(archivo(25))
    renderWithProviders(<NoticiasPage />, { ruta: '/?mostrar=21' })
    expect(await screen.findByRole('link', { name: /noticia 21\b/i })).toBeInTheDocument()
    expect(tarjetas()).toHaveLength(21)
  })
})
