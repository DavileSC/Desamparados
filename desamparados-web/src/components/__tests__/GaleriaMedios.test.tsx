import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import GaleriaMedios from '../GaleriaMedios'
import { DURACION_PASE } from '../galeria/Escenario'
import type { MedioGaleria } from '../../lib/api/contenido'

const FOTO: MedioGaleria = {
  tipo: 'foto', url: '/storage/public/camarin.webp', portada: '',
  alt: 'La Virgen en su camarín', pie: 'Camarín, 2026',
}

const OTRA: MedioGaleria = {
  tipo: 'foto', url: '/storage/public/trono.webp', portada: '',
  alt: 'El trono en la calle', pie: '',
}

const VIDEO: MedioGaleria = {
  tipo: 'video', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  portada: '/storage/public/salida.webp', alt: 'Salida procesional de 2026', pie: '',
}

/** Un clip subido desde el CMS. */
const CLIP: MedioGaleria = {
  tipo: 'video', url: '/storage/public/0123456789abcdef0123456789abcdef.mp4',
  portada: '/storage/public/salida-clip.webp', alt: 'La salida desde la parroquia', pie: '',
}

/** La foto grande del escenario: el botón que la amplía. */
const escenario = () => screen.getByRole('button', { name: /^(ampliar|reproducir): /i })

afterEach(() => { vi.useRealTimers() })

describe('GaleriaMedios en escritorio (escenario)', () => {
  it('no pinta nada si no hay medios: la sección se oculta entera', () => {
    const { container } = renderWithProviders(<GaleriaMedios medios={[]} disposicion="escritorio" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('enseña la foto con su descripción y su pie', () => {
    renderWithProviders(<GaleriaMedios medios={[FOTO]} disposicion="escritorio" />)
    expect(within(escenario()).getByAltText('La Virgen en su camarín')).toBeInTheDocument()
    expect(screen.getByText('Camarín, 2026')).toBeInTheDocument()
  })

  it('con un solo medio no hay flechas, ni miniaturas, ni pase que pausar', () => {
    renderWithProviders(<GaleriaMedios medios={[FOTO]} disposicion="escritorio" />)
    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ver: /i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pausar el pase/i })).not.toBeInTheDocument()
  })

  it('las flechas y las miniaturas cambian la foto, en bucle', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[FOTO, OTRA, VIDEO]} disposicion="escritorio" />)

    await user.click(screen.getByRole('button', { name: /^siguiente$/i }))
    expect(escenario()).toHaveAccessibleName('Ampliar: El trono en la calle')
    await user.click(screen.getByRole('button', { name: /^anterior$/i }))
    await user.click(screen.getByRole('button', { name: /^anterior$/i }))
    expect(escenario()).toHaveAccessibleName('Reproducir: Salida procesional de 2026')
    await user.click(screen.getByRole('button', { name: 'Ver: La Virgen en su camarín' }))
    expect(escenario()).toHaveAccessibleName('Ampliar: La Virgen en su camarín')
  })

  it('pasa sola cada pocos segundos, y deja de pasar con la pausa', () => {
    vi.useFakeTimers()
    renderWithProviders(<GaleriaMedios medios={[FOTO, OTRA]} disposicion="escritorio" />)

    act(() => { vi.advanceTimersByTime(DURACION_PASE) })
    expect(escenario()).toHaveAccessibleName('Ampliar: El trono en la calle')

    fireEvent.click(screen.getByRole('button', { name: /pausar el pase/i }))
    act(() => { vi.advanceTimersByTime(DURACION_PASE * 3) })
    expect(escenario()).toHaveAccessibleName('Ampliar: El trono en la calle')
    expect(screen.getByRole('button', { name: /reanudar el pase/i })).toBeInTheDocument()
  })

  it('con el visor abierto, el pase de detrás se para', () => {
    vi.useFakeTimers()
    renderWithProviders(<GaleriaMedios medios={[FOTO, OTRA]} disposicion="escritorio" />)
    fireEvent.click(escenario())
    act(() => { vi.advanceTimersByTime(DURACION_PASE * 2) })
    const visor = screen.getByRole('dialog', { name: /galería ampliada/i })
    expect(within(visor).getByText('Camarín, 2026')).toBeInTheDocument()
  })

  it('la foto se amplía en el visor, que se pasa con el teclado y se cierra con Esc', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[FOTO, OTRA]} disposicion="escritorio" />)

    await user.click(escenario())
    const visor = await screen.findByRole('dialog', { name: /galería ampliada/i })
    expect(within(visor).getByAltText('La Virgen en su camarín')).toBeInTheDocument()
    expect(within(visor).getByText('Camarín, 2026')).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(within(visor).getByAltText('El trono en la calle')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Al cerrar, el escenario se queda en la última vista.
    expect(escenario()).toHaveAccessibleName('Ampliar: El trono en la calle')
  })

  it('un vídeo no llama a YouTube hasta que se pulsa el play, y entonces suena ahí mismo, sin abrir el visor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[VIDEO]} disposicion="escritorio" />)

    expect(document.querySelector('iframe')).toBeNull()
    await user.click(screen.getByRole('button', { name: /reproducir/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const marco = document.querySelector('iframe')
    expect(marco).not.toBeNull()
    expect(marco!.getAttribute('src')).toContain('youtube-nocookie.com')
    expect(marco!.getAttribute('src')).toContain('autoplay=1')
  })

  it('en una galería de solo vídeos, un clip nuestro suena en el escenario; el pase espera y sigue cuando acaba', () => {
    vi.useFakeTimers()
    renderWithProviders(<GaleriaMedios medios={[CLIP, VIDEO]} disposicion="escritorio" />)

    fireEvent.click(screen.getByRole('button', { name: /reproducir: la salida/i }))
    const video = document.querySelector('video')!
    expect(video).toHaveAttribute('src', CLIP.url)
    expect(video).toHaveAttribute('poster', CLIP.portada)
    expect(video.controls).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Mientras suena, el pase no lo quita de delante.
    act(() => { vi.advanceTimersByTime(DURACION_PASE * 3) })
    expect(document.querySelector('video')).not.toBeNull()

    fireEvent.ended(video)
    expect(document.querySelector('video')).toBeNull()
    act(() => { vi.advanceTimersByTime(DURACION_PASE) })
    expect(escenario()).toHaveAccessibleName('Reproducir: Salida procesional de 2026')
  })

  it('pasar a otro medio para el vídeo', () => {
    renderWithProviders(<GaleriaMedios medios={[CLIP, VIDEO]} disposicion="escritorio" />)
    fireEvent.click(screen.getByRole('button', { name: /reproducir: la salida/i }))
    expect(document.querySelector('video')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^siguiente$/i }))
    expect(document.querySelector('video')).toBeNull()
  })

  it('si la galería mezcla fotos y vídeos, el vídeo se abre en el visor, como antes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[CLIP, FOTO]} disposicion="escritorio" />)
    await user.click(screen.getByRole('button', { name: /reproducir: la salida/i }))
    const visor = await screen.findByRole('dialog', { name: /galería ampliada/i })
    expect(visor.querySelector('video')).toHaveAttribute('src', CLIP.url)
  })

  it('llegar a un vídeo dentro del visor no lo carga: hay que darle al play', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[FOTO, VIDEO]} disposicion="escritorio" />)

    await user.click(escenario())
    const visor = await screen.findByRole('dialog')
    await user.click(within(visor).getByRole('button', { name: /^siguiente$/i }))
    expect(visor.querySelector('iframe')).toBeNull()

    await user.click(within(visor).getByRole('button', { name: /reproducir: salida/i }))
    expect(visor.querySelector('iframe')).not.toBeNull()
  })
})

describe('GaleriaMedios en el móvil (carril)', () => {
  it('pinta todos los medios en el carril, y tocar uno lo abre a pantalla completa', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[FOTO, OTRA, VIDEO]} disposicion="movil" />)

    expect(screen.getAllByRole('button', { name: /^(ampliar|reproducir): /i })).toHaveLength(3)
    expect(screen.getByText(/desliza para pasar/i)).toBeInTheDocument()
    // En el móvil no hay pase automático: el dedo manda.
    expect(screen.queryByRole('button', { name: /pausar el pase/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ampliar: El trono en la calle' }))
    const visor = await screen.findByRole('dialog', { name: /galería ampliada/i })
    expect(within(visor).getByText(/baja para cerrar/i)).toBeInTheDocument()
    expect(within(visor).getByText('02')).toBeInTheDocument()

    await user.click(within(visor).getByRole('button', { name: 'Cerrar' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('en una galería de solo vídeos, tocar uno del carril lo reproduce ahí mismo, sin abrir el visor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[CLIP, VIDEO]} disposicion="movil" />)

    expect(document.querySelector('video')).toBeNull()
    await user.click(screen.getByRole('button', { name: /reproducir: la salida/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('video')).toHaveAttribute('src', CLIP.url)
    expect(screen.getByText(/toca para verlo$/)).toBeInTheDocument()
  })

  it('un vídeo que no es el primero del carril también suena al tocarlo', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[VIDEO, CLIP]} disposicion="movil" />)
    await user.click(screen.getByRole('button', { name: /reproducir: la salida/i }))
    expect(document.querySelector('video')).toHaveAttribute('src', CLIP.url)
  })

  it('en el móvil, con fotos y vídeos mezclados, el vídeo se abre en el visor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[CLIP, FOTO]} disposicion="movil" />)
    await user.click(screen.getByRole('button', { name: /reproducir: la salida/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
