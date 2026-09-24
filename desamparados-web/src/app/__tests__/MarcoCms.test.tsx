import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import MarcoCms from '../MarcoCms'
import { itemsMenu, rolesPorRutaCms } from '../cmsNavegacion'
import { useAuthStore } from '../../features/altas/auth/store'
import { CLAVE_TEMA_CMS } from '../temaCms'

/** Un enlace del menú por su dirección: plegado su grupo, no tiene nombre accesible. */
function enlace(container: HTMLElement, href: string) {
  return container.querySelector(`a[href="${href}"]`)
}

function entrarComo(role: string) {
  useAuthStore.setState({
    status: 'listo',
    cms: { id: 1, email: 'prueba@ejemplo.es', role, perfiles: [], origen: 'cms' },
    hermano: null,
  })
}

describe('MarcoCms', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'cargando', cms: null, hermano: null })
  })

  // El menú del Hermano Mayor va plegado: los permisos se miran con los grupos cerrados también.
  it('el Hermano Mayor ve tesorería y contabilidad', () => {
    entrarComo('HERMANO_MAYOR')
    const { container } = renderWithProviders(<MarcoCms />)
    expect(enlace(container, '/cms/tesoreria')).toBeInTheDocument()
    expect(enlace(container, '/cms/contabilidad')).toBeInTheDocument()
  })

  it('el Hermano Mayor ve noticias y publicaciones: todo salvo la administración del sistema', () => {
    entrarComo('HERMANO_MAYOR')
    const { container } = renderWithProviders(<MarcoCms />)
    expect(enlace(container, '/cms/noticias')).toBeInTheDocument()
    expect(enlace(container, '/cms/publicaciones')).toBeInTheDocument()
  })

  it('el community manager no ve tesorería', () => {
    entrarComo('REDES')
    const { container } = renderWithProviders(<MarcoCms />)
    expect(enlace(container, '/cms/tesoreria')).not.toBeInTheDocument()
  })

  it('la barra lateral se queda fija al bajar por la página', () => {
    // En Tesorería la página mide veinte mil píxeles: si el menú se va con el
    // scroll, se navega a ciegas.
    entrarComo('ADMIN')
    const { container } = renderWithProviders(<MarcoCms />)
    const barra = container.querySelector('aside')!
    const estilo = getComputedStyle(barra)
    expect(estilo.position).toBe('sticky')
    expect(estilo.height).toBe('100vh')
  })

  it('el menú conserva su fondo cuando es más alto que la ventana', () => {
    // Con el menú desbordado, `barra` medía 100vh y su contenido seguía más
    // abajo: el fondo oscuro se acababa y asomaba el de la página. Invisible
    // en tema oscuro, evidente en claro, donde el menú parecía borrarse.
    entrarComo('ADMIN')
    const { container } = renderWithProviders(<MarcoCms />)
    const aside = container.querySelector('aside')!
    const barra = aside.firstElementChild as HTMLElement

    // El fondo vive en el contenedor que hace scroll, no solo en el hijo.
    expect(getComputedStyle(aside).backgroundColor).toBe(getComputedStyle(barra).backgroundColor)
    expect(getComputedStyle(aside).backgroundColor).not.toBe('')
    expect(getComputedStyle(aside).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

    // Y el hijo crece con su contenido en lugar de quedarse clavado a la ventana.
    expect(getComputedStyle(barra).minHeight).toBe('100%')
    expect(getComputedStyle(barra).height).not.toBe('100%')
  })

  it('no lleva cabecera superior con el nombre del Grupo Parroquial', () => {
    entrarComo('SECRETARIA')
    renderWithProviders(<MarcoCms />)
    expect(screen.queryByText('Grupo Parroquial Nuestra Señora de los Desamparados')).not.toBeInTheDocument()
    expect(screen.queryByText('Administración')).not.toBeInTheDocument()
  })
})

const PANEL_MINIMO = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: {
    porEstado: [{ estado: 'DEVUELTO', total: 14, importe: 420 }],
    devueltosPendientes: { total: 14, importe: 420 },
    ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: null },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
  },
}

function responder(cuerpo: unknown = PANEL_MINIMO, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

describe('el menú del Inicio', () => {
  beforeEach(() => { localStorage.clear(); responder() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('la primera entrada es Inicio, no Panel', async () => {
    entrarComo('REDES')
    renderWithProviders(<MarcoCms />)
    const enlaces = screen.getAllByRole('link')
    expect(enlaces[1]).toHaveAccessibleName('Inicio') // [0] es el logotipo
  })

  it('agrupa las secciones por áreas', () => {
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />)
    for (const grupo of ['Web', 'Censo y procesión', 'Cuentas', 'Sistema']) {
      expect(screen.getByText(grupo)).toBeInTheDocument()
    }
    // El Inicio va suelto, sin rótulo encima.
    expect(screen.queryByText('Hoy')).not.toBeInTheDocument()
  })

  it('un cargo acotado solo ve los grupos que le tocan', () => {
    entrarComo('REDES')
    renderWithProviders(<MarcoCms />)
    expect(screen.getByText('Web')).toBeInTheDocument()
    // Sin Tesorería ni Contabilidad, el grupo «Cuentas» no tiene nada que agrupar.
    expect(screen.queryByText('Cuentas')).not.toBeInTheDocument()
    expect(screen.queryByText('Censo y enseres')).not.toBeInTheDocument()
  })

  it('los contadores salen de los datos del panel', async () => {
    entrarComo('SECRETARIA')
    renderWithProviders(<MarcoCms />)
    // 3 hermanos sin número; Secretaría ve el menú abierto entero.
    expect(await screen.findByLabelText('Hermanos: 3 pendientes')).toHaveTextContent('3')
    // Tesorería no lleva número aunque haya 14 devueltos: se ven en su tarjeta.
    expect(screen.queryByLabelText(/^Tesorería:/)).not.toBeInTheDocument()
  })

  it('sin nada pendiente no pinta contadores', async () => {
    responder({
      ...PANEL_MINIMO,
      censo: { ...PANEL_MINIMO.censo, sinNumeroHermano: 0 },
      dinero: { ...PANEL_MINIMO.dinero, porEstado: [], devueltosPendientes: { total: 0, importe: 0 } },
      actividad: { ...PANEL_MINIMO.actividad, noticias: { publicadas: 4, borradores: 0 } },
    })
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />)
    await screen.findByRole('button', { name: /^Web/ })
    expect(screen.queryByLabelText(/pendientes$/)).not.toBeInTheDocument()
  })

  it('si el panel falla, el menú se pinta igual', async () => {
    responder({}, 500)
    entrarComo('ADMIN')
    const { container } = renderWithProviders(<MarcoCms />)
    expect(await screen.findByRole('button', { name: /Cuentas/ })).toBeInTheDocument()
    expect(enlace(container, '/cms/tesoreria')).toBeInTheDocument()
  })

  it('el interruptor de tema arranca en oscuro y recuerda el cambio', async () => {
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />)
    const interruptor = screen.getByRole('switch', { name: 'Modo oscuro' })
    expect(interruptor).toBeChecked()
    await userEvent.click(interruptor)
    expect(interruptor).not.toBeChecked()
    expect(localStorage.getItem(CLAVE_TEMA_CMS)).toBe('claro')
  })

  it('el bloque de usuario dice el cargo y, al pulsarlo, ofrece su seguridad y salir', async () => {
    entrarComo('SECRETARIA')
    renderWithProviders(<MarcoCms />)
    expect(screen.getByText('Secretaría')).toBeInTheDocument()
    // Mi seguridad es de quien entra, no una sección del Grupo: no va en el menú lateral.
    expect(screen.getByRole('navigation', { name: 'Secciones del CMS' }).querySelector('a[href="/cms/mi-seguridad"]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Cuenta: Secretaría' }))
    expect(screen.getByRole('menuitem', { name: 'Mi seguridad' })).toHaveAttribute('href', '/cms/mi-seguridad')
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('el interruptor de tema va en la cabecera, junto a la marca', () => {
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />)
    const marca = screen.getAllByRole('link')[0]
    expect(marca.parentElement).toContainElement(screen.getByRole('switch', { name: 'Modo oscuro' }))
  })
})

describe('los grupos del menú se pliegan cuando son muchos', () => {
  beforeEach(() => { localStorage.clear(); responder() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('quien ve pocas secciones las ve todas, sin plegar', () => {
    entrarComo('SECRETARIA')
    renderWithProviders(<MarcoCms />)
    expect(screen.getByRole('link', { name: 'Mesa de procesión' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Censo y procesión/ })).not.toBeInTheDocument()
  })

  it('el grupo de la página en la que se está va abierto y los demás plegados', () => {
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />, { ruta: '/cms/tesoreria' })
    expect(screen.getByRole('link', { name: 'Tesorería' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Cuentas/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Cuentas/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Web/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Noticias' })).not.toBeInTheDocument()
  })

  it('plegado, el grupo sigue enseñando sus avisos', async () => {
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />)
    // 2 borradores en Noticias y 3 hermanos sin número, con sus grupos cerrados.
    expect(await screen.findByLabelText('Web: 2 pendientes')).toHaveTextContent('2')
    expect(screen.getByLabelText('Censo y procesión: 3 pendientes')).toHaveTextContent('3')
  })

  it('abrir un grupo lo enseña con sus avisos y se recuerda en el ordenador', async () => {
    entrarComo('ADMIN')
    const { unmount } = renderWithProviders(<MarcoCms />)
    await screen.findByLabelText('Web: 2 pendientes')
    await userEvent.click(screen.getByRole('button', { name: /^Web/ }))
    expect(await screen.findByLabelText('Noticias: 2 pendientes')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /^Noticias/ })).toBeVisible()
    unmount()

    renderWithProviders(<MarcoCms />)
    expect(screen.getByRole('button', { name: /^Web/ })).toHaveAttribute('aria-expanded', 'true')
  })
})

/**
 * Nadie tocaba ExigeRol hasta ahora, y por eso el menú y las guardas de
 * ruta se desincronizaron sin que ningún test lo notara: el Hermano Mayor
 * veía Tesorería, Contabilidad y Auditoría en el menú, pero la guarda de
 * `routes/index.tsx` seguía sin él y lo expulsaba a /area-hermano en cuanto
 * pulsaba. Este test compara las dos fuentes de verdad entrada por entrada
 * para que no puedan volver a divergir en silencio.
 */
describe('el menú del CMS y las guardas de ruta no divergen', () => {
  it('cada entrada de itemsMenu ve exactamente los roles que deja pasar su guarda de ruta', () => {
    expect(itemsMenu.length).toBeGreaterThan(0)

    for (const item of itemsMenu) {
      const clave = (item.href === '/cms' ? 'panel' : item.href.slice('/cms/'.length)) as keyof typeof rolesPorRutaCms
      const rolesGuarda = rolesPorRutaCms[clave]
      expect(rolesGuarda, `${item.href} no tiene guarda declarada en rolesPorRutaCms`).toBeDefined()
      expect([...item.roles].sort()).toEqual([...rolesGuarda].sort())
    }
  })
})

/**
 * Las pantallas de edición son rutas nuevas que no aparecen en el menú, así que
 * el test de arriba no las mira. Si una se montara con una guarda distinta a la
 * de su listado, quien no puede ver el listado podría editar desde la URL.
 */
describe('las pantallas de edición se guardan como su listado', () => {
  it('cada sección con edición propia tiene su guarda declarada', () => {
    for (const seccion of ['noticias', 'publicaciones', 'agenda', 'hermanos', 'inventario'] as const) {
      expect(rolesPorRutaCms[seccion], `${seccion} no tiene guarda`).toBeDefined()
    }
  })
})

/**
 * El color del texto del CMS lo ponía el `body` de la web pública, que es
 * blanco sobre fondo oscuro. Al envolver el CMS en el tema claro, el lienzo
 * pasó a `#f4f2ee` pero el texto siguió heredando aquel blanco: los `<h1>` de
 * las cinco pantallas y los subtítulos que no van dentro de una tarjeta se
 * quedaron a 1.06:1 de contraste, ilegibles. Lo que sí vive dentro de un
 * `Paper` se salvaba de casualidad, porque MUI le aplica `text.primary`.
 *
 * Desde que el CMS arranca en modo oscuro, la misma trampa se puede colar al
 * revés: basta con que algo vuelva a dejar el `body` en un color ajeno para
 * que el modo activo, claro u oscuro, herede lo que no debe. Los dos casos de
 * abajo ensucian el `body` con un color que no es el esperado en ningún modo
 * y comprueban que `<main>` fija el suyo propio, herede lo que herede.
 */
describe('el CMS no hereda el color de texto de la web pública', () => {
  beforeEach(() => {
    localStorage.removeItem(CLAVE_TEMA_CMS)
  })

  afterEach(() => {
    document.body.style.removeProperty('color')
  })

  it('en modo oscuro (el arranque por defecto) el contenido fija el texto en blanco', () => {
    document.body.style.color = '#ff00ff' // un color que no es el esperado en ningún modo
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />)

    // El color es la variable del tema del CMS (jsdom no la resuelve): propio, no el heredado.
    expect(getComputedStyle(screen.getByRole('main')).color).toBe('var(--cms-palette-text-primary)')
    expect(document.documentElement).toHaveAttribute('data-cms-modo', 'dark')
  })

  it('en modo claro el contenido fija el texto oscuro del tema', () => {
    localStorage.setItem(CLAVE_TEMA_CMS, 'claro')
    document.body.style.color = '#ff00ff' // un color que no es el esperado en ningún modo
    entrarComo('ADMIN')
    renderWithProviders(<MarcoCms />)

    expect(getComputedStyle(screen.getByRole('main')).color).toBe('var(--cms-palette-text-primary)')
    expect(document.documentElement).toHaveAttribute('data-cms-modo', 'light')
  })
})

describe('accesos al CMS', () => {
  // Repartir cargos es repartir privilegios: ni el Hermano Mayor entra aquí.
  // El backend ya lo estrecha así (`checkRole(SOLO_ADMIN)` en adminRoutes), y el
  // menú no debe ofrecer una pantalla que va a devolver un 403.
  it('solo el administrador ve la sección de accesos', () => {
    const accesos = itemsMenu.find((item) => item.href === '/cms/accesos')
    expect(accesos, 'falta la entrada de accesos en el menú del CMS').toBeDefined()
    expect(accesos!.roles).toEqual(['ADMIN'])
    expect(rolesPorRutaCms.accesos).toEqual(['ADMIN'])
  })
})
