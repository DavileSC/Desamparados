import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import PublicacionesDestacadas from '../PublicacionesDestacadas'
import { textosDePrueba } from './ayudas'
import type { TextosPortada } from '../../../lib/api/portada'

afterEach(() => { vi.unstubAllGlobals() })

const publicacion = (id: number, titulo: string, fecha: string, categoria: string, imagenUrl: string | null = null) => ({
  id, titulo, descripcion: `Descripción de ${titulo}`, imagenUrl, archivoUrl: `/storage/public/documentos/${id}.pdf`, fecha, categoria, visible: true, fijada: false,
})

const BOLETIN = publicacion(1, 'Boletín informativo n.º 12', '2026-08-21T08:00:00.000Z', 'boletin')
const ANUARIO = publicacion(5, 'Anuario 2025-2026', '2026-06-12T08:00:00.000Z', 'anuario')
const DOSSIER = publicacion(4, 'Dossier de la estación de penitencia', '2026-04-13T08:00:00.000Z', 'dossier')

function servir(publicaciones: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify(publicaciones),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
}

/**
 * El botón del archivo solo se pinta cuando hay una publicación destacada, así que
 * a diferencia de `responderPortada` (ayudas.ts) esta responde con datos reales de
 * `/publications/latest`, no con una lista vacía.
 */
function responderConPublicaciones(textos: TextosPortada, publicaciones: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: unknown) => Promise.resolve(new Response(
    JSON.stringify(String(url).includes('/portada') ? { imagenes: [], textos } : publicaciones),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))))
}

describe('PublicacionesDestacadas', () => {
  it('destaca la última publicación con su descarga y el enlace al archivo', async () => {
    servir([BOLETIN, ANUARIO, DOSSIER])
    renderWithProviders(<PublicacionesDestacadas />)

    expect(await screen.findByRole('heading', { level: 3, name: BOLETIN.titulo })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /descargar/i })).toHaveAttribute('href', BOLETIN.archivoUrl)
    expect(screen.getByRole('link', { name: /archivo de publicaciones/i })).toHaveAttribute('href', '/publicaciones')
  })

  it('lista el resto de publicaciones, cada una enlazada a su documento', async () => {
    servir([BOLETIN, ANUARIO, DOSSIER])
    renderWithProviders(<PublicacionesDestacadas />)

    const otras = await screen.findByRole('list', { name: /otras publicaciones/i })
    const enlaces = within(otras).getAllByRole('link')
    expect(enlaces.map(a => a.getAttribute('href'))).toEqual([ANUARIO.archivoUrl, DOSSIER.archivoUrl])
    expect(enlaces[0]).toHaveTextContent(ANUARIO.titulo)
  })

  it('sin imagen pinta una portada tipográfica con el número del boletín; con imagen, la foto', async () => {
    // Se rompe si una publicación sin portada deja un hueco vacío, o si se ignora la imagen cuando la hay.
    servir([BOLETIN])
    const { unmount } = renderWithProviders(<PublicacionesDestacadas />)
    const portada = await screen.findByTestId('portada-publicacion')
    expect(within(portada).getByText('12')).toBeInTheDocument()
    expect(portada.querySelector('img')).toBeNull()
    unmount()

    servir([{ ...BOLETIN, imagenUrl: '/storage/portada.jpg' }])
    renderWithProviders(<PublicacionesDestacadas />)
    const conFoto = await screen.findByTestId('portada-publicacion')
    expect(conFoto.querySelector('img')).toHaveAttribute('src', '/storage/portada.jpg')
  })

  it('apila detrás del ejemplar las dos publicaciones anteriores, cada una con su cubierta', async () => {
    // Se rompe si el abanico deja huecos cuando hay pocas publicaciones o si repite la destacada.
    servir([BOLETIN, ANUARIO, DOSSIER])
    const { unmount } = renderWithProviders(<PublicacionesDestacadas />)
    const detras = await screen.findAllByTestId('ejemplar-anterior')
    expect(detras).toHaveLength(2)
    expect(detras[0]).toHaveTextContent(/anuario/i)
    expect(detras[1]).toHaveTextContent(/dossier/i)
    unmount()

    servir([BOLETIN])
    renderWithProviders(<PublicacionesDestacadas />)
    await screen.findByTestId('portada-publicacion')
    expect(screen.queryAllByTestId('ejemplar-anterior')).toHaveLength(0)
  })

  it('en la cubierta de un anuario pone su curso y no un año suelto', async () => {
    servir([ANUARIO])
    renderWithProviders(<PublicacionesDestacadas />)
    const portada = await screen.findByTestId('portada-publicacion')
    expect(within(portada).getByText('25·26')).toBeInTheDocument()
  })

  it('enseña el botón del archivo y la marca de agua que vienen del CMS', async () => {
    const textos = textosDePrueba()
    textos.publicaciones = { boton: 'Ver todo el archivo', marcaDeAgua: 'PARROQUIA' }
    responderConPublicaciones(textos, [BOLETIN])

    renderWithProviders(<PublicacionesDestacadas />)

    expect(await screen.findByRole('link', { name: 'Ver todo el archivo' })).toHaveAttribute('href', '/publicaciones')
    expect(screen.getByText('PARROQUIA')).toBeInTheDocument()
  })

  it('la del puesto grande lleva la cinta si está destacada, y si no, ninguna', async () => {
    servir([{ ...DOSSIER, fijada: true }, BOLETIN, ANUARIO])
    const { unmount } = renderWithProviders(<PublicacionesDestacadas />)
    expect(await screen.findByText('Destacada')).toBeInTheDocument()
    unmount()

    vi.unstubAllGlobals()
    servir([BOLETIN, ANUARIO, DOSSIER])
    renderWithProviders(<PublicacionesDestacadas />)
    await screen.findByRole('heading', { level: 3, name: BOLETIN.titulo })
    expect(screen.queryByText('Destacada')).toBeNull()
  })
})
