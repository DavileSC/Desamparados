import { describe, it, expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import type { ApiEvent } from '../../../../lib/api/agenda'
import CartelDeCulto from '../CartelDeCulto'

const triduo: ApiEvent = {
  id: 7, title: 'Solemne Triduo', description: null, location: null,
  startDate: new Date('2026-11-03T19:00').toISOString(), endDate: null, type: 'CULTO', cartel: true,
}

describe('CartelDeCulto', () => {
  it('sin foto propia, la fija de la instalación; si esta no la tiene, el cartel se queda sin foto y sin hueco', () => {
    renderWithProviders(<CartelDeCulto evento={triduo} />)
    const foto = screen.getByRole('img')
    expect(foto.getAttribute('src')).toMatch(/^\/images\//)

    // Otra instalación: la fija da 404.
    fireEvent.error(foto)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Solemne Triduo' })).toBeInTheDocument()
  })
})
