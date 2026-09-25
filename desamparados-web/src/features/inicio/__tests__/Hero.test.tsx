import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import Hero from '../Hero'
import { IMAGENES_POR_DEFECTO, INTERVALO_ROTACION_MS } from '../heroImagenes'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const respuestaPortada = (textos: unknown) => vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
  Promise.resolve(new Response(JSON.stringify({ imagenes: [], textos }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))))

const FOTOS = [
  { id: 1, url: '/storage/public/primera.webp', descripcion: 'Primera foto', orden: 0 },
  { id: 2, url: '/storage/public/segunda.webp', descripcion: 'Segunda foto', orden: 1 },
]

describe('Hero', () => {
  it('los textos entran nada más montarse: no esperan a que un observador los vea', () => {
    // El hero ya está a la vista al cargar la página; si dependiera del
    // IntersectionObserver, la coreografía arrancaría tarde o no arrancaría.
    const observe = vi.spyOn(IntersectionObserver.prototype, 'observe')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ imagenes: [] })))
    renderWithProviders(<Hero />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(observe).not.toHaveBeenCalled()
    observe.mockRestore()
  })

  it('ofrece la agenda como segunda acción, no las noticias que ya vienen justo debajo', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ imagenes: [] })))
    renderWithProviders(<Hero />)

    expect(screen.getByRole('link', { name: /conoce el grupo parroquial/i })).toHaveAttribute('href', '/historia')
    expect(screen.getByRole('link', { name: /agenda y cultos/i })).toHaveAttribute('href', '/agenda')
    expect(screen.queryByRole('link', { name: /ver actualidad/i })).not.toBeInTheDocument()
  })

  it('rota las fotos del CMS: la siguiente ya está montada y pasa a ser la visible al cumplirse el intervalo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ imagenes: FOTOS })))
    renderWithProviders(<Hero />)

    // La primera es la visible: accesible por su nombre y con la prioridad de carga alta.
    const primera = await screen.findByRole('img', { name: 'Primera foto' })
    expect(primera).toHaveAttribute('src', '/storage/public/primera.webp')
    expect(primera).toHaveAttribute('fetchpriority', 'high')
    // La segunda se precarga tapada, fuera del árbol de accesibilidad.
    expect(screen.getByAltText('Segunda foto')).toHaveAttribute('aria-hidden', 'true')

    act(() => { vi.advanceTimersByTime(INTERVALO_ROTACION_MS) })

    expect(screen.getByAltText('Segunda foto')).not.toHaveAttribute('aria-hidden')
    expect(screen.getByAltText('Primera foto')).toHaveAttribute('aria-hidden', 'true')

    // Y vuelve a empezar.
    act(() => { vi.advanceTimersByTime(INTERVALO_ROTACION_MS) })
    expect(screen.getByAltText('Primera foto')).not.toHaveAttribute('aria-hidden')
  })

  it('con una sola foto no hay rotación', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ imagenes: [FOTOS[0]] })))
    renderWithProviders(<Hero />)

    await screen.findByRole('img', { name: 'Primera foto' })
    act(() => { vi.advanceTimersByTime(INTERVALO_ROTACION_MS * 3) })
    expect(screen.getByAltText('Primera foto')).not.toHaveAttribute('aria-hidden')
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('sin fotos en el CMS, o sin API, enseña la de siempre', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ imagenes: [] })))
    const { unmount } = renderWithProviders(<Hero />)
    expect(await screen.findByRole('img', { name: IMAGENES_POR_DEFECTO[0].descripcion })).toHaveAttribute('src', IMAGENES_POR_DEFECTO[0].url)
    unmount()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('sin red')))
    renderWithProviders(<Hero />)
    expect(await screen.findByRole('img', { name: IMAGENES_POR_DEFECTO[0].descripcion })).toHaveAttribute('src', IMAGENES_POR_DEFECTO[0].url)
  })

  it('no pinta ninguna foto hasta saber cuál va primero', () => {
    // Si se pintara la de siempre mientras llega la lista, cada visita empezaría
    // con un fundido de la foto vieja a la nueva.
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    renderWithProviders(<Hero />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('enseña los textos que llegan del servidor', async () => {
    const textos = structuredClone(POR_DEFECTO.portada)
    textos.hero.titulo = 'Desamparados de Málaga'
    textos.hero.parrafo = 'Un párrafo distinto.'
    respuestaPortada(textos)

    renderWithProviders(<Hero />)

    expect(await screen.findByRole('heading', { name: 'Desamparados de Málaga', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Un párrafo distinto.')).toBeInTheDocument()
  })

  it('si la API falla, enseña los textos de siempre en vez de un hueco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))

    renderWithProviders(<Hero />)

    expect(await screen.findByRole('heading', { name: 'Desamparados Málaga', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Devoción, historia y patrimonio/)).toBeInTheDocument()
  })
})
