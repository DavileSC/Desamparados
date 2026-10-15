import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import BarraDeNavegacion from '../BarraDeNavegacion'
import { DATOS } from '../../test/instalacion'
import { TODOS_CON_PAGINAS_PROPIAS } from '../../test/queryClient'
import { responderPortada, textosDePrueba } from '../../features/inicio/__tests__/ayudas'

// El ejemplo no tiene redes (son null): una, para ver que el menú la enlaza.
// Las redes llegan de la API (no de la instalación), y las pruebas las siembran
// en la caché desde DATOS al pintar (test/queryClient.ts).
const instagramOriginal = DATOS.redes.instagram
beforeAll(() => { DATOS.redes.instagram = 'https://www.instagram.com/corporacion.example/' })
afterAll(() => { DATOS.redes.instagram = instagramOriginal })

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

  it('muestra las siete secciones; las que despliegan no llevan a ninguna página', () => {
    renderWithProviders(<BarraDeNavegacion />)
    const nav = navEscritorio()
    for (const etiqueta of ['Inicio', 'Contacto']) {
      expect(within(nav).getByRole('link', { name: etiqueta, hidden: true })).toBeInTheDocument()
    }
    for (const etiqueta of ['Corporación', 'Sagrada titular', 'Actualidad', 'Publicaciones', 'Hermanos']) {
      expect(within(nav).getByRole('button', { name: etiqueta, hidden: true })).not.toHaveAttribute('href')
      expect(within(nav).queryByRole('link', { name: etiqueta, hidden: true })).not.toBeInTheDocument()
    }
  })

  it('pulsar el título de una sección no hace nada: el panel sigue abierto', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const titular = within(navEscritorio()).getByRole('button', { name: 'Sagrada titular', hidden: true })
    await user.click(titular)
    await user.click(titular)
    expect(titular).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Ajuar', hidden: true })).toHaveAttribute('href', '/ajuar')
  })

  it('no enseña las subpáginas hasta que se abre una sección', () => {
    renderWithProviders(<BarraDeNavegacion />)
    expect(screen.queryByRole('link', { name: 'Historia', hidden: true })).not.toBeInTheDocument()
  })

  it('al pasar el ratón por Corporación despliega sus subpáginas con sus enlaces', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { modulos: TODOS_CON_PAGINAS_PROPIAS })
    await user.hover(within(navEscritorio()).getByRole('button', { name: 'Corporación', hidden: true }))

    expect(screen.getByRole('link', { name: 'Historia', hidden: true })).toHaveAttribute('href', '/historia')
    expect(screen.getByRole('link', { name: 'Órganos de Gobierno', hidden: true })).toHaveAttribute(
      'href',
      '/historia/organos-de-gobierno',
    )
    expect(screen.getByRole('link', { name: 'Enseres', hidden: true })).toHaveAttribute('href', '/sabado-de-pasion/enseres')
  })

  it('con un nombre puesto en el CMS, la página sale con él; sin él, con el de siempre', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { nombresEnMenu: { '/parroquia': 'Parroquia · Pasionistas', '/contacto': 'Escríbenos' } })
    expect(within(navEscritorio()).getByRole('link', { name: 'Escríbenos', hidden: true })).toHaveAttribute('href', '/contacto')
    await user.hover(within(navEscritorio()).getByRole('button', { name: 'Corporación', hidden: true }))
    expect(screen.getByRole('link', { name: 'Parroquia · Pasionistas', hidden: true })).toHaveAttribute('href', '/parroquia')
    expect(screen.queryByRole('link', { name: 'Parroquia', hidden: true })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cultos', hidden: true })).toHaveAttribute('href', '/cultos')
  })

  it('sin las páginas propias, Corporación despliega sin ellas', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.hover(within(navEscritorio()).getByRole('button', { name: 'Corporación', hidden: true }))

    expect(screen.getByRole('link', { name: 'Historia', hidden: true })).toHaveAttribute('href', '/historia')
    expect(screen.queryByRole('link', { name: 'Enseres', hidden: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Rosario', hidden: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sábado de Pasión', hidden: true })).not.toBeInTheDocument()
  })

  it('cierra el desplegable al retirar el ratón', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const corporacion = within(navEscritorio()).getByRole('button', { name: 'Corporación', hidden: true })
    await user.hover(corporacion)
    expect(screen.getByRole('link', { name: 'Historia', hidden: true })).toBeInTheDocument()

    await user.unhover(corporacion)
    expect(screen.queryByRole('link', { name: 'Historia', hidden: true })).not.toBeInTheDocument()
  })

  it('abre la sección al llegar con el teclado y la cierra con Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const hermanos = within(navEscritorio()).getByRole('button', { name: 'Hermanos', hidden: true })
    act(() => hermanos.focus())
    expect(hermanos).toHaveAttribute('aria-expanded', 'true')
    // «Acceso hermanos» está también en el botón de la barra: con la sección abierta, son dos.
    const accesos = () => screen.queryAllByRole('link', { name: 'Acceso hermanos', hidden: true })
    expect(accesos()).toHaveLength(2)
    expect(accesos().every((a) => a.getAttribute('href') === '/acceso')).toBe(true)

    await user.keyboard('{Escape}')
    expect(hermanos).toHaveAttribute('aria-expanded', 'false')
    expect(accesos()).toHaveLength(1)
  })

  it('tras cerrar con Escape, Enter y Espacio la vuelven a abrir y a cerrar', async () => {
    // Antes no tenían efecto: para reabrir había que salir de la sección y volver.
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const hermanos = within(navEscritorio()).getByRole('button', { name: 'Hermanos', hidden: true })
    act(() => hermanos.focus())
    await user.keyboard('{Escape}')
    expect(hermanos).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{Enter}')
    expect(hermanos).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard(' ')
    expect(hermanos).toHaveAttribute('aria-expanded', 'false')
  })

  it('las secciones sin subpáginas no anuncian desplegable', () => {
    renderWithProviders(<BarraDeNavegacion />)
    expect(within(navEscritorio()).getByRole('link', { name: 'Contacto', hidden: true })).not.toHaveAttribute('aria-haspopup')
  })

  it('marca con un chevron solo las secciones que despliegan', () => {
    renderWithProviders(<BarraDeNavegacion />)
    const nav = navEscritorio()
    const corporacion = within(nav).getByRole('button', { name: 'Corporación', hidden: true })
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
    // Las secciones con subpáginas solo se despliegan; Contacto sí lleva a su página.
    expect(within(cajon).getByRole('button', { name: 'Corporación' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(cajon).queryByRole('link', { name: 'Hermanos' })).not.toBeInTheDocument()
    expect(within(cajon).getByRole('link', { name: 'Contacto' })).toHaveAttribute('href', '/contacto')
    expect(within(cajon).queryByRole('link', { name: 'Historia' })).not.toBeInTheDocument()
  })

  it('al desplegar Corporación aparecen sus subpáginas, con los subniveles incluidos', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.click(screen.getByRole('button', { name: 'Corporación' }))

    expect(screen.getByRole('link', { name: 'Historia' })).toHaveAttribute('href', '/historia')
    expect(screen.getByRole('link', { name: 'Órganos de Gobierno' })).toHaveAttribute('href', '/historia/organos-de-gobierno')
    expect(screen.getByRole('button', { name: 'Corporación' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('el botón del acceso y los títulos de sección llevan también el nombre del CMS', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { nombresEnMenu: { '/acceso': 'Área de hermanos', 'seccion:/sagrada-titular': 'Sagrados titulares' } })
    expect(within(navEscritorio()).getByRole('button', { name: 'Sagrados titulares', hidden: true })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Área de hermanos', hidden: true }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Acceso hermanos', hidden: true })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('button', { name: 'Sagrados titulares' })).toBeInTheDocument()
    expect(screen.queryByText('Acceso hermanos')).not.toBeInTheDocument()
  })

  it('el cajón usa también los nombres puestos en el CMS', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { nombresEnMenu: { '/parroquia': 'Parroquia · Pasionistas' } })
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.click(screen.getByRole('button', { name: 'Corporación' }))
    expect(screen.getByRole('link', { name: 'Parroquia · Pasionistas' })).toHaveAttribute('href', '/parroquia')
  })

  it('llega con la sección de la página actual ya desplegada', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { ruta: '/ajuar' })
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(screen.getByRole('link', { name: 'Ajuar' })).toHaveAttribute('href', '/ajuar')
    expect(screen.queryByRole('link', { name: 'Historia' })).not.toBeInTheDocument()
  })

  // Las capas salen antes de que el cajón se quite: hay que esperar a que acaben.
  it('la X lo cierra, y vuelve a abrirse con la sección de la página actual', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { ruta: '/ajuar' })
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }))
    expect(screen.getByRole('button', { name: 'Abrir menú', hidden: true })).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Menú' })).not.toBeInTheDocument())

    // findByRole y no getByRole: la página sigue con aria-hidden hasta que acaba
    // la transición del cierre, y con el CI cargado el botón aún no se veía
    // (docs/notas-del-proyecto.md, sección 6).
    await user.click(await screen.findByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('link', { name: 'Ajuar' })).toHaveAttribute('href', '/ajuar')
  })

  it('Escape lo cierra', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Menú' })).not.toBeInTheDocument())
  })

  it('el fondo lleva la opacidad del CMS y, mientras está abierto, apaga los textos sobre las fotos', async () => {
    // Se rompe si el panel vuelve a ser opaco sin mirar el CMS, o si los textos
    // de la cabecera se quedan encima de la foto, pisándose con los del menú.
    const textos = textosDePrueba()
    textos.menuMovil = { opacidad: 60 }
    responderPortada(textos)
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Menú' })).toHaveStyle({ backgroundColor: 'rgba(12, 11, 13, 0.6)' }))
    expect(document.documentElement).toHaveAttribute('data-menu-abierto')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-menu-abierto'))
  })

  it('al pie, el acceso de hermanos y las redes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const menu = screen.getByRole('navigation', { name: 'Menú' })
    expect(within(menu).getByRole('link', { name: 'Acceso hermanos' })).toHaveAttribute('href', '/acceso')
    expect(within(menu).getByRole('link', { name: 'Instagram' })).toHaveAttribute('target', '_blank')
  })
})
