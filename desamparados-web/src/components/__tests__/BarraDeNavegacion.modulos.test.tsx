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

  // «Acceso hermanos» ya no va en el pie, y en jsdom la barra es la del móvil,
  // que lo guarda en el cajón: aquí solo se comprueba lo que el pie enlaza.
  it('con todo encendido, el pie enlaza la tienda y el alta', () => {
    renderWithProviders(<><BarraDeNavegacion /><PieDePagina /></>)
    expect(screen.getAllByRole('link', { name: 'Hazte hermano' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Tienda' }).length).toBeGreaterThan(0)
  })

  it('sin la agenda, el pie no la enlaza; con ella, sí', () => {
    const { unmount } = renderWithProviders(<PieDePagina />, { modulos: ['noticias'] })
    expect(screen.queryByRole('link', { name: 'Agenda' })).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<PieDePagina />)
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda')
  })

  it('el pie firma el desarrollo web con su LinkedIn', () => {
    renderWithProviders(<PieDePagina />)
    expect(screen.getByRole('link', { name: /David Silva Cuevas/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/david-silva-cuevas/')
  })
})
