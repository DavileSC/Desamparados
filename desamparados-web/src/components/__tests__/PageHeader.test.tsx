import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import PageHeader from '../PageHeader'

describe('PageHeader', () => {
  it('con imageAlt, la foto lleva esa descripción', () => {
    renderWithProviders(
      <PageHeader title="Corporación" image="/storage/public/foto.webp" imageAlt="Fachada de la parroquia" />,
    )
    expect(screen.getByAltText('Fachada de la parroquia')).toBeInTheDocument()
  })

  it('sin imageAlt, la foto cae en el título: páginas con foto fija fuera del CMS (Sagrada Titular) no se quedan sin descripción', () => {
    renderWithProviders(<PageHeader title="Sagrada Titular" image="/images/hero-960.jpg" />)
    expect(screen.getByAltText('Sagrada Titular')).toBeInTheDocument()
  })
})
