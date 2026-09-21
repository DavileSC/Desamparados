import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import BarraDeNavegacion from '../BarraDeNavegacion'

/**
 * jsdom no trae `matchMedia`, y sin él MUI da por hecho que ninguna media query
 * casa (es decir, escritorio). Para probar el cajón móvil hay que fingir un ancho.
 */
function simularAncho(ancho: number) {
  window.matchMedia = (query: string): MediaQueryList => {
    const max = /max-width:\s*(\d+)px/.exec(query)
    const min = /min-width:\s*(\d+)px/.exec(query)
    const matches = (!max || ancho <= Number(max[1])) && (!min || ancho >= Number(min[1]))
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  }
}

const matchMediaOriginal = window.matchMedia

afterEach(() => {
  window.matchMedia = matchMediaOriginal
})

function navEscritorio() {
  return screen.getByRole('navigation', { name: 'Navegación principal', hidden: true })
}

describe('BarraDeNavegacion en escritorio', () => {
  beforeEach(() => simularAncho(1440))

  it('muestra las siete secciones del mapa del sitio, incluida Hermanos', () => {
    renderWithProviders(<BarraDeNavegacion />)
    const nav = navEscritorio()
    const etiquetas = ['Inicio', 'Corporación', 'Sagrada titular', 'Actualidad', 'Publicaciones', 'Hermanos', 'Contacto']
    for (const etiqueta of etiquetas) {
      expect(within(nav).getByRole('link', { name: etiqueta, hidden: true })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Hermanos', hidden: true })).toHaveAttribute('href', '/hermanos')
  })

  it('no enseña las subpáginas hasta que se abre una sección', () => {
    renderWithProviders(<BarraDeNavegacion />)
    expect(screen.queryByRole('link', { name: 'Historia', hidden: true })).not.toBeInTheDocument()
  })

  it('al pasar el ratón por Corporación despliega sus subpáginas con sus enlaces', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.hover(within(navEscritorio()).getByRole('link', { name: 'Corporación', hidden: true }))

    expect(screen.getByRole('link', { name: 'Historia', hidden: true })).toHaveAttribute('href', '/corporacion/historia')
    expect(screen.getByRole('link', { name: 'Órganos de Gobierno', hidden: true })).toHaveAttribute(
      'href',
      '/corporacion/historia/organos-de-gobierno',
    )
    expect(screen.getByRole('link', { name: 'Enseres', hidden: true })).toHaveAttribute('href', '/corporacion/sabado-de-pasion/enseres')
  })

  it('cierra el desplegable al retirar el ratón', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const corporacion = within(navEscritorio()).getByRole('link', { name: 'Corporación', hidden: true })
    await user.hover(corporacion)
    expect(screen.getByRole('link', { name: 'Historia', hidden: true })).toBeInTheDocument()

    await user.unhover(corporacion)
    expect(screen.queryByRole('link', { name: 'Historia', hidden: true })).not.toBeInTheDocument()
  })

  it('abre la sección al llegar con el teclado y la cierra con Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const hermanos = within(navEscritorio()).getByRole('link', { name: 'Hermanos', hidden: true })
    act(() => hermanos.focus())
    expect(hermanos).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Login hermanos', hidden: true })).toHaveAttribute('href', '/hermanos/acceso')

    await user.keyboard('{Escape}')
    expect(hermanos).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Login hermanos', hidden: true })).not.toBeInTheDocument()
  })

  it('las secciones sin subpáginas no anuncian desplegable', () => {
    renderWithProviders(<BarraDeNavegacion />)
    expect(within(navEscritorio()).getByRole('link', { name: 'Contacto', hidden: true })).not.toHaveAttribute('aria-haspopup')
  })

  it('marca con un chevron solo las secciones que despliegan', () => {
    renderWithProviders(<BarraDeNavegacion />)
    const nav = navEscritorio()
    const corporacion = within(nav).getByRole('link', { name: 'Corporación', hidden: true })
    const contacto = within(nav).getByRole('link', { name: 'Contacto', hidden: true })
    expect(within(corporacion).getByTestId('ExpandMoreIcon')).toBeInTheDocument()
    expect(within(contacto).queryByTestId('ExpandMoreIcon')).not.toBeInTheDocument()
  })
})

describe('BarraDeNavegacion en móvil', () => {
  beforeEach(() => simularAncho(390))

  it('el cajón muestra las secciones de primer nivel plegadas', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    const cajon = screen.getByRole('presentation')
    expect(within(cajon).getByRole('link', { name: 'Corporación' })).toHaveAttribute('href', '/corporacion')
    expect(within(cajon).getByRole('link', { name: 'Hermanos' })).toHaveAttribute('href', '/hermanos')
    expect(within(cajon).queryByRole('link', { name: 'Historia' })).not.toBeInTheDocument()
  })

  it('al desplegar Corporación aparecen sus subpáginas, con los subniveles incluidos', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.click(screen.getByRole('button', { name: 'Desplegar Corporación' }))

    expect(screen.getByRole('link', { name: 'Historia' })).toHaveAttribute('href', '/corporacion/historia')
    expect(screen.getByRole('link', { name: 'Órganos de Gobierno' })).toHaveAttribute('href', '/corporacion/historia/organos-de-gobierno')
    expect(screen.getByRole('button', { name: 'Plegar Corporación' })).toBeInTheDocument()
  })

  it('llega con la sección de la página actual ya desplegada', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { ruta: '/sagrada-titular/ajuar' })
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(screen.getByRole('link', { name: 'Ajuar' })).toHaveAttribute('href', '/sagrada-titular/ajuar')
    expect(screen.queryByRole('link', { name: 'Historia' })).not.toBeInTheDocument()
  })
})
