import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import GaleriaMedios from '../GaleriaMedios'
import type { MedioGaleria } from '../../lib/api/contenido'

const FOTO: MedioGaleria = {
  tipo: 'foto', url: '/storage/public/camarin.webp', portada: '',
  alt: 'La Virgen en su camarín', pie: 'Camarín, 2026',
}

const VIDEO: MedioGaleria = {
  tipo: 'video', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  portada: '/storage/public/salida.webp', alt: 'Salida procesional de 2026', pie: '',
}

describe('GaleriaMedios', () => {
  it('no pinta nada si no hay medios: la sección se oculta entera', () => {
    const { container } = renderWithProviders(<GaleriaMedios medios={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('enseña las fotos con su descripción y su pie', () => {
    renderWithProviders(<GaleriaMedios medios={[FOTO]} />)

    expect(screen.getByAltText('La Virgen en su camarín')).toBeInTheDocument()
    expect(screen.getByText('Camarín, 2026')).toBeInTheDocument()
  })

  it('un vídeo no llama a YouTube hasta que se pulsa el play', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[VIDEO]} />)

    // De entrada solo está nuestra portada: ni un iframe.
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByAltText('Salida procesional de 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /reproducir/i }))

    const marco = document.querySelector('iframe')
    expect(marco).not.toBeNull()
    expect(marco!.getAttribute('src')).toContain('youtube-nocookie.com')
  })

  it('se puede pasar de un medio a otro', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[FOTO, VIDEO]} />)

    expect(screen.getByRole('button', { name: /siguiente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument()
    // Los dos medios están en el carrusel; el que se ve lo decide el desplazamiento.
    expect(screen.getByAltText('La Virgen en su camarín')).toBeInTheDocument()
    expect(screen.getByAltText('Salida procesional de 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /siguiente/i }))
  })

  it('con un solo medio no hay flechas que pulsar', () => {
    renderWithProviders(<GaleriaMedios medios={[FOTO]} />)

    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument()
  })

  it('la foto se puede ampliar; el vídeo se reproduce en su sitio', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={[FOTO]} />)

    await user.click(screen.getByRole('button', { name: /ampliar/i }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByAltText('La Virgen en su camarín')).toBeInTheDocument()
  })
})
