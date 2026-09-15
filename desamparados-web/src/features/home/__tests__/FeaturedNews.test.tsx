import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import FeaturedNews from '../FeaturedNews'
import { responderPortada, textosDePrueba } from './ayudas'

afterEach(() => { vi.unstubAllGlobals() })

const noticia = (id: number, slug: string, titulo: string, fecha: string, imagenUrl: string | null = null) => ({
  id, slug, titulo, extracto: `Extracto de ${titulo}`, contenido: '<p>Texto</p>', imagenUrl, fecha, visible: true,
})

const APERTURA = noticia(1, 'apertura-curso', 'Apertura del curso cofrade 2026-2027', '2026-09-07T10:00:00.000Z', '/storage/apertura.jpg')
const TRIDUO = noticia(2, 'solemne-triduo', 'Solemne triduo', '2026-08-29T10:00:00.000Z')
const CAMPANA = noticia(3, 'campana-alimentos', 'Campaña de recogida de alimentos', '2026-08-16T10:00:00.000Z')
const CABILDO = noticia(4, 'cabildo', 'Cabildo general', '2026-07-01T10:00:00.000Z')

function servir(noticias: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify(noticias),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
}

describe('FeaturedNews', () => {
  it('pinta cada noticia como una tarjeta enlazada a su ficha, con fecha, título y extracto', async () => {
    servir([APERTURA, TRIDUO, CAMPANA])
    renderWithProviders(<FeaturedNews />)

    const tarjeta = await screen.findByRole('link', { name: /apertura del curso/i })
    expect(tarjeta).toHaveAttribute('href', '/actualidad/noticias/apertura-curso')
    expect(within(tarjeta).getByRole('heading', { level: 3 })).toHaveTextContent(APERTURA.titulo)
    expect(within(tarjeta).getByText(APERTURA.extracto)).toBeInTheDocument()
    // La fecha va en un <time> legible por máquinas; el texto visible es corto («7 sep 2026»).
    const fecha = tarjeta.querySelector('time')
    expect(fecha).toHaveAttribute('datetime', APERTURA.fecha)
    expect(fecha).toHaveTextContent(/7\s*sep\s*2026/i)
    expect(screen.getByRole('heading', { level: 2, name: /últimas noticias/i })).toBeInTheDocument()
  })

  it('usa la foto de la noticia y, si no la tiene, una placa con su inicial', async () => {
    // Se rompe si una noticia sin foto deja un hueco vacío, o si se ignora la foto cuando la hay.
    servir([APERTURA, TRIDUO])
    renderWithProviders(<FeaturedNews />)

    const conFoto = await screen.findByRole('link', { name: /apertura del curso/i })
    expect(conFoto.querySelector('img')).toHaveAttribute('src', '/storage/apertura.jpg')
    const sinFoto = screen.getByRole('link', { name: /solemne triduo/i })
    expect(sinFoto.querySelector('img')).toBeNull()
    expect(within(sinFoto).getByTestId('placa-noticia')).toHaveTextContent('S')
  })

  it('enseña como mucho tres noticias y enlaza al archivo completo', async () => {
    servir([APERTURA, TRIDUO, CAMPANA, CABILDO])
    renderWithProviders(<FeaturedNews />)

    await screen.findByRole('link', { name: /apertura del curso/i })
    const lista = screen.getByRole('list', { name: /últimas noticias/i })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('link', { name: /cabildo general/i })).toBeNull()
    expect(screen.getByRole('link', { name: /ver todas/i })).toHaveAttribute('href', '/actualidad/noticias')
  })

  it('alterna el tono de las placas para que varias noticias sin foto no formen un bloque del mismo color', async () => {
    // Se rompe si todas las placas vuelven a salir del mismo color: tres seguidas pesan como un solo bloque.
    servir([TRIDUO, CAMPANA, CABILDO])
    renderWithProviders(<FeaturedNews />)

    await screen.findByRole('link', { name: /solemne triduo/i })
    const tonos = screen.getAllByTestId('placa-noticia').map(placa => placa.getAttribute('data-tono'))
    expect(tonos).toHaveLength(3)
    expect(new Set(tonos).size).toBe(3)
  })

  it('enseña la ceja, el título y el enlace que vienen del CMS', async () => {
    const textos = textosDePrueba()
    textos.actualidad = { ceja: 'Lo último', titulo: 'Novedades', enlace: 'Ver el archivo' }
    responderPortada(textos)

    renderWithProviders(<FeaturedNews />)

    expect(await screen.findByText('Lo último')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Novedades' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver el archivo/i })).toBeInTheDocument()
  })
})
