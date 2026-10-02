import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import BarraDeNavegacion from '../BarraDeNavegacion'
import PieDePagina from '../PieDePagina'

describe('la barra y el pie con módulos apagados', () => {
  it('sin el área de hermanos no hay botón «Acceso hermanos»; sin tienda-web, el pie no enlaza la tienda', () => {
    renderWithProviders(<><BarraDeNavegacion /><PieDePagina /></>, { modulos: ['noticias', 'agenda', 'publicaciones'] })
    expect(screen.queryByRole('link', { name: 'Acceso hermanos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tienda' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Noticias' }).length).toBeGreaterThan(0)
  })

  it('con todo encendido, los dos están', () => {
    renderWithProviders(<><BarraDeNavegacion /><PieDePagina /></>)
    expect(screen.getAllByRole('link', { name: 'Acceso hermanos' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Tienda' }).length).toBeGreaterThan(0)
  })
})
