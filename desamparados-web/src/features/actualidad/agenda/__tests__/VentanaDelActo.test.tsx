import { describe, it, expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import type { ApiEvent } from '../../../../lib/api/agenda'
import VentanaDelActo from '../VentanaDelActo'

const triduo: ApiEvent = {
  id: 7, title: 'Solemne Triduo', description: null, location: null,
  startDate: new Date('2026-11-03T19:00').toISOString(), endDate: null, type: 'CULTO', cartel: true,
}
const SUBIDA = '/storage/public/0123456789abcdef0123456789abcdef.webp'

const ventana = (evento: ApiEvent, sinHora = false) =>
  renderWithProviders(<VentanaDelActo evento={evento} origen={null} quieto esDialogo={false} onCerrar={() => {}} sinHora={sinHora} />)

describe('VentanaDelActo', () => {
  it('sin foto propia, la fija de la instalación; si esta no la tiene, la ventana se queda sin foto y sin hueco', () => {
    ventana(triduo)
    const foto = screen.getByRole('img')
    expect(foto.getAttribute('src')).toMatch(/^\/images\//)

    // Otra instalación: la fija da 404.
    fireEvent.error(foto)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Solemne Triduo' })).toBeInTheDocument()
  })

  it('la foto subida se pide en las copias que caben en la ventana, no en la original de 1920 px', () => {
    ventana({ ...triduo, fotoCartel: SUBIDA })
    const foto = screen.getByRole('img')
    expect(foto).toHaveAttribute('srcset', expect.stringContaining('-640.webp 640w'))
    expect(foto).toHaveAttribute('sizes', '360px')
  })

  it('en la vista previa del CMS, sin hora todavía, no se inventa una', () => {
    ventana(triduo, true)
    expect(screen.queryByText(/a las/)).not.toBeInTheDocument()
  })
})
