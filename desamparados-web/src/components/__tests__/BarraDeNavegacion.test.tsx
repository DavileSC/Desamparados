import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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

  it('muestra las siete entradas; las que despliegan no llevan a ninguna página', () => {
    renderWithProviders(<BarraDeNavegacion />)
    const nav = navEscritorio()
    for (const etiqueta of ['Inicio', 'Sagrada titular', 'Contacto']) {
      expect(within(nav).getByRole('link', { name: etiqueta, hidden: true })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Hermanos', hidden: true })).toHaveAttribute('href', '/acceso')
    for (const etiqueta of ['Actualidad', 'Corporación', 'Publicaciones']) {
      expect(within(nav).getByRole('button', { name: etiqueta, hidden: true })).not.toHaveAttribute('href')
      expect(within(nav).queryByRole('link', { name: etiqueta, hidden: true })).not.toBeInTheDocument()
    }
  })

  it('pulsar el título de una sección no hace nada: el panel sigue abierto', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const actualidad = within(navEscritorio()).getByRole('button', { name: 'Actualidad', hidden: true })
    await user.click(actualidad)
    await user.click(actualidad)
    expect(actualidad).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Agenda', hidden: true })).toHaveAttribute('href', '/agenda')
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
    // Con fireEvent y no con user.click: en jsdom, mover el ratón de user-event a
    // cualquier cosa de la hoja dispara el mouseleave de la sección y la cierra.
    fireEvent.click(screen.getByRole('button', { name: 'Páginas de Nuestros fines', hidden: true }))
    expect(screen.getByRole('link', { name: 'Vida', hidden: true })).toHaveAttribute('href', '/nuestros-fines/vida')
    fireEvent.click(screen.getByRole('button', { name: 'Páginas de Sábado de Pasión', hidden: true }))
    expect(screen.getByRole('link', { name: 'Patrimonio', hidden: true })).toHaveAttribute('href', '/sabado-de-pasion/patrimonio')
  })

  it('en la hoja, las subpáginas de una página salen en una segunda hoja, de una en una', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { modulos: TODOS_CON_PAGINAS_PROPIAS })
    await user.hover(within(navEscritorio()).getByRole('button', { name: 'Corporación', hidden: true }))
    const fines = screen.getByRole('button', { name: 'Páginas de Nuestros fines', hidden: true })
    const sabado = screen.getByRole('button', { name: 'Páginas de Sábado de Pasión', hidden: true })
    // Fuera de un grupo, ningún panel abierto.
    expect(fines).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Vida', hidden: true })).not.toBeInTheDocument()

    fireEvent.click(fines)
    expect(fines).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Vida', hidden: true })).toHaveAttribute('href', '/nuestros-fines/vida')

    fireEvent.click(sabado)
    expect(fines).toHaveAttribute('aria-expanded', 'false')
    expect(sabado).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('link', { name: 'Vida', hidden: true })).not.toBeInTheDocument()
    // El nombre sigue llevando a su página.
    expect(screen.getByRole('link', { name: 'Sábado de Pasión', hidden: true })).toHaveAttribute('href', '/sabado-de-pasion')

    // Con el ratón, quedándose un momento en la fila.
    const cultos = screen.getByRole('button', { name: 'Páginas de Cultos', hidden: true })
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Cultos', hidden: true }).closest('li')!)
    await waitFor(() => expect(cultos).toHaveAttribute('aria-expanded', 'true'))
    expect(screen.getByRole('link', { name: 'Rosario', hidden: true })).toHaveAttribute('href', '/cultos/rosario')
  })

  it('pasar de largo por otra fila no cambia la segunda hoja abierta', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { modulos: TODOS_CON_PAGINAS_PROPIAS })
    await user.hover(within(navEscritorio()).getByRole('button', { name: 'Corporación', hidden: true }))
    const fines = screen.getByRole('button', { name: 'Páginas de Nuestros fines', hidden: true })
    fireEvent.click(fines)
    // Camino de Caridad en diagonal, el ratón cruza la fila de Cultos y llega a
    // la segunda hoja, que es parte de la fila de Nuestros fines.
    // Con `relatedTarget`: sin él, React lo toma como salir de la ventana y
    // cierra la hoja entera.
    const filaDeCultos = screen.getByRole('link', { name: 'Cultos', hidden: true }).closest('li')!
    const caridad = screen.getByRole('link', { name: 'Caridad', hidden: true })
    expect(fines.closest('li')).toContainElement(caridad)
    fireEvent.mouseEnter(filaDeCultos)
    fireEvent.mouseLeave(filaDeCultos, { relatedTarget: caridad })
    fireEvent.mouseEnter(fines.closest('li')!, { relatedTarget: filaDeCultos })
    await new Promise((r) => setTimeout(r, 400))
    expect(fines).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Páginas de Cultos', hidden: true })).toHaveAttribute('aria-expanded', 'false')
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
    expect(screen.queryByRole('link', { name: 'Patrimonio', hidden: true })).not.toBeInTheDocument()
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
    const publicaciones = within(navEscritorio()).getByRole('button', { name: 'Publicaciones', hidden: true })
    act(() => publicaciones.focus())
    expect(publicaciones).toHaveAttribute('aria-expanded', 'true')
    const newsletter = () => screen.queryAllByRole('link', { name: 'Newsletter', hidden: true })
    expect(newsletter()).toHaveLength(1)
    expect(newsletter()[0]).toHaveAttribute('href', '/publicaciones/newsletter')

    await user.keyboard('{Escape}')
    expect(publicaciones).toHaveAttribute('aria-expanded', 'false')
    expect(newsletter()).toHaveLength(0)
  })

  it('tras cerrar con Escape, Enter y Espacio la vuelven a abrir y a cerrar', async () => {
    // Antes no tenían efecto: para reabrir había que salir de la sección y volver.
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    const publicaciones = within(navEscritorio()).getByRole('button', { name: 'Publicaciones', hidden: true })
    act(() => publicaciones.focus())
    await user.keyboard('{Escape}')
    expect(publicaciones).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{Enter}')
    expect(publicaciones).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard(' ')
    expect(publicaciones).toHaveAttribute('aria-expanded', 'false')
  })

  it('las secciones sin subpáginas no anuncian desplegable', () => {
    renderWithProviders(<BarraDeNavegacion />)
    expect(within(navEscritorio()).getByRole('link', { name: 'Contacto', hidden: true })).not.toHaveAttribute('aria-haspopup')
  })

  it('arriba, el nombre corto y la localidad, que lleva a la portada', () => {
    renderWithProviders(<BarraDeNavegacion />)
    const nombre = [DATOS.identidad.nombreCorto, DATOS.identidad.localidad].filter(Boolean).join(' ')
    const marca = screen.getByRole('link', { name: nombre, hidden: true })
    expect(marca).toHaveAttribute('href', '/')
  })
})

describe('BarraDeNavegacion en móvil', () => {
  beforeEach(() => simularAncho(390))

  it('el cajón muestra las secciones de primer nivel plegadas', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    const cajon = screen.getByRole('presentation')
    // Las secciones con subpáginas solo se despliegan; Hermanos y Contacto sí llevan a su página.
    expect(within(cajon).getByRole('button', { name: 'Corporación' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(cajon).queryByRole('link', { name: 'Corporación' })).not.toBeInTheDocument()
    expect(within(cajon).getByRole('link', { name: 'Hermanos' })).toHaveAttribute('href', '/acceso')
    expect(within(cajon).getByRole('link', { name: 'Contacto' })).toHaveAttribute('href', '/contacto')
    expect(within(cajon).queryByRole('link', { name: 'Historia' })).not.toBeInTheDocument()
  })

  it('al desplegar Corporación aparecen sus subpáginas, con los subniveles plegados tras su flecha', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.click(screen.getByRole('button', { name: 'Corporación' }))

    expect(screen.getByRole('link', { name: 'Historia' })).toHaveAttribute('href', '/historia')
    expect(screen.getByRole('button', { name: 'Corporación' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('link', { name: 'Caridad' })).not.toBeInTheDocument()

    // Caridad y no Vida: esta prueba no enciende las páginas propias.
    const flecha = screen.getByRole('button', { name: 'Páginas de Nuestros fines' })
    await user.click(flecha)
    expect(flecha).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Caridad' })).toHaveAttribute('href', '/nuestros-fines/caridad')
  })

  it('en el cajón, un grupo de subpáginas abierto cada vez', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { modulos: TODOS_CON_PAGINAS_PROPIAS })
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.click(screen.getByRole('button', { name: 'Corporación' }))
    await user.click(screen.getByRole('button', { name: 'Páginas de Nuestros fines' }))
    await user.click(screen.getByRole('button', { name: 'Páginas de Sábado de Pasión' }))

    expect(screen.getByRole('button', { name: 'Páginas de Nuestros fines' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Recorrido' })).toHaveAttribute('href', '/sabado-de-pasion/recorrido')
  })

  it('los títulos de sección y «Hermanos» llevan el nombre del CMS; el botón del acceso, el suyo', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { nombresEnMenu: { '/acceso': 'Área de hermanos', 'seccion:/publicaciones': 'Archivo' } })
    expect(within(navEscritorio()).getByRole('button', { name: 'Archivo', hidden: true })).toBeInTheDocument()
    expect(within(navEscritorio()).getByRole('link', { name: 'Área de hermanos', hidden: true })).toHaveAttribute('href', '/acceso')
    // El botón no sigue al nombre de la entrada: «Área de hermanos» y «Acceso hermanos» a la vez.
    expect(screen.getAllByRole('link', { name: 'Acceso hermanos', hidden: true }).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('button', { name: 'Archivo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Área de hermanos' })).toHaveAttribute('href', '/acceso')
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
    renderWithProviders(<BarraDeNavegacion />, { ruta: '/agenda' })
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda')
    expect(screen.queryByRole('link', { name: 'Historia' })).not.toBeInTheDocument()
  })

  // Las capas salen antes de que el cajón se quite: hay que esperar a que acaben.
  it('la X lo cierra, y vuelve a abrirse con la sección de la página actual', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BarraDeNavegacion />, { ruta: '/agenda' })
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }))
    expect(screen.getByRole('button', { name: 'Abrir menú', hidden: true })).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Menú' })).not.toBeInTheDocument())

    // findByRole y no getByRole: la página sigue con aria-hidden hasta que acaba
    // la transición del cierre, y con el CI cargado el botón aún no se veía
    // (docs/notas-del-proyecto.md, sección 6).
    await user.click(await screen.findByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda')
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
