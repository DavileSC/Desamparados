import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('con muchas fotos monta solo la visible, la siguiente y la que acaba de salir', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const hex = (n: number) => String(n).repeat(32)
    const fotos = [1, 2, 3, 4, 5].map((n) => ({ id: n, url: `/storage/public/${hex(n)}.webp`, descripcion: `Foto ${n}`, orden: n }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ imagenes: fotos })))
    const { container } = renderWithProviders(<Hero />)
    const montadas = () => [...container.querySelectorAll('img')].map((img) => img.alt)

    const primera = await screen.findByRole('img', { name: 'Foto 1' })
    expect(montadas()).toEqual(['Foto 1', 'Foto 2'])
    // Las fotos subidas llevan sus copias reducidas; solo la primera corre.
    expect(primera).toHaveAttribute('srcset', expect.stringContaining(`${hex(1)}-640.webp 640w`))
    expect(screen.getByAltText('Foto 2')).toHaveAttribute('fetchpriority', 'low')
    expect(screen.getByAltText('Foto 2')).toHaveAttribute('loading', 'lazy')

    act(() => { vi.advanceTimersByTime(INTERVALO_ROTACION_MS) })
    expect(montadas()).toEqual(['Foto 1', 'Foto 2', 'Foto 3'])
    act(() => { vi.advanceTimersByTime(INTERVALO_ROTACION_MS) })
    expect(montadas()).toEqual(['Foto 2', 'Foto 3', 'Foto 4'])
    // Al dar la vuelta, la última sigue debajo mientras la primera se funde encima.
    act(() => { vi.advanceTimersByTime(INTERVALO_ROTACION_MS * 3) })
    expect(montadas()).toEqual(['Foto 1', 'Foto 2', 'Foto 5'])
    expect(screen.getByAltText('Foto 1')).not.toHaveAttribute('aria-hidden')
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

  describe('con vídeo de fondo', () => {
    const VIDEO = '/storage/public/0123456789abcdef0123456789abcdef.mp4'
    const conVideo = () => {
      const textos = structuredClone(POR_DEFECTO.portada)
      textos.hero.video = VIDEO
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ imagenes: FOTOS, textos })))
    }
    const videoDe = (contenedor: HTMLElement) => contenedor.querySelector('video')

    afterEach(() => {
      vi.restoreAllMocks()
      Reflect.deleteProperty(navigator, 'connection')
    })

    it('sustituye a las fotos: la primera es lo que se ve mientras carga, y no rota', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      conVideo()
      const { container } = renderWithProviders(<Hero />)

      await screen.findByRole('button', { name: /pausar el vídeo de fondo/i })
      const video = videoDe(container)!
      expect(video).toHaveAttribute('src', VIDEO)
      expect(video).toHaveAttribute('poster', '/storage/public/primera.webp')
      // En bucle y sin sonido: sin `muted` ningún navegador lo arranca solo.
      expect(video.muted).toBe(true)
      expect(video.loop).toBe(true)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(INTERVALO_ROTACION_MS * 2) })
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('se puede pausar y reanudar', async () => {
      let parado = false
      vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => parado)
      const pausa = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => { parado = true })
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => { parado = false; return Promise.resolve() })
      conVideo()
      renderWithProviders(<Hero />)

      await userEvent.click(await screen.findByRole('button', { name: /pausar el vídeo de fondo/i }))
      expect(pausa).toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: /reanudar el vídeo de fondo/i }))
      expect(screen.getByRole('button', { name: /pausar el vídeo de fondo/i })).toBeInTheDocument()
    })

    it('con el ahorro de datos puesto no se descarga: se quedan las fotos', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })
      conVideo()
      const { container } = renderWithProviders(<Hero />)

      expect(await screen.findByRole('img', { name: 'Primera foto' })).toBeInTheDocument()
      expect(videoDe(container)).toBeNull()
      expect(screen.queryByRole('button', { name: /vídeo de fondo/i })).not.toBeInTheDocument()
    })

    it('si el vídeo no carga, vuelven las fotos', async () => {
      conVideo()
      const { container } = renderWithProviders(<Hero />)

      await screen.findByRole('button', { name: /pausar el vídeo de fondo/i })
      fireEvent.error(videoDe(container)!)
      expect(await screen.findByRole('img', { name: 'Primera foto' })).toBeInTheDocument()
      expect(videoDe(container)).toBeNull()
    })
  })
})
