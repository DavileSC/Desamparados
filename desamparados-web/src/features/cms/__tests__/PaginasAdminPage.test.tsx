import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { crearTemaCms } from '../../../theme/cms'
import PaginasAdminPage from '../PaginasAdminPage'
import { PAGINAS_PUBLICAS, itemsMenu, rolesPorRutaCms } from '../../../app/cmsNavegacion'
import CATALOGO from '../../../../../shared/paginas-publicas.json'

/** Las secciones que se pliegan: las de una sola página con su mismo nombre son ya un enlace. */
const seccionesPlegables = () => [...new Set(PAGINAS_PUBLICAS.map((p) => p.grupo))]
  .filter((grupo) => { const suyas = PAGINAS_PUBLICAS.filter((p) => p.grupo === grupo); return !(suyas.length === 1 && suyas[0].nombre === grupo) })

function montar() {
  render(
    <HelmetProvider>
      <ThemeProvider theme={crearTemaCms('claro')}>
        <MemoryRouter><PaginasAdminPage /></MemoryRouter>
      </ThemeProvider>
    </HelmetProvider>,
  )
}

describe('PaginasAdminPage', () => {
  it('enseña una entrada por cada página del catálogo compartido', async () => {
    const user = userEvent.setup()
    montar()
    for (const grupo of seccionesPlegables()) {
      await user.click(screen.getByRole('button', { name: new RegExp(grupo) }))
    }
    // El índice no lleva su propia lista: sale de shared/paginas-publicas.json,
    // que es el mismo fichero que el servidor comprueba. Convertir una página
    // más tiene que hacerla aparecer aquí sola.
    expect(PAGINAS_PUBLICAS.length).toBeGreaterThan(0)
    for (const pagina of PAGINAS_PUBLICAS) {
      // Por nombre exacto: la fila tiene otro enlace, el de ver la página en
      // la web, cuyo nombre accesible también empieza por el de la página.
      expect(screen.getByRole('link', { name: pagina.nombre })).toHaveAttribute(
        'href', `/cms/paginas/${pagina.slug}`,
      )
    }
  })

  it('cada página ofrece verla en la web, en otra pestaña y sin acceso a esta', async () => {
    const user = userEvent.setup()
    montar()
    const pagina = PAGINAS_PUBLICAS[0]
    await user.click(screen.getByRole('button', { name: new RegExp(pagina.grupo) }))
    const ver = screen.getByRole('link', { name: new RegExp(`Ver ${pagina.nombre} en la web`) })
    expect(ver).toHaveAttribute('href', pagina.ruta)
    expect(ver).toHaveAttribute('target', '_blank')
    expect(ver).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('el catálogo declara todo lo que el índice necesita para pintarse', () => {
    // Una página a medio declarar dejaría una fila sin nombre o un enlace a
    // ninguna parte, y eso no lo nota nadie hasta abrir el CMS.
    for (const pagina of CATALOGO.paginas) {
      expect(pagina.slug, 'slug').toMatch(/^[a-z0-9-]+$/)
      expect(pagina.nombre.trim(), `nombre de ${pagina.slug}`).not.toBe('')
      expect(pagina.descripcion.trim(), `descripción de ${pagina.slug}`).not.toBe('')
      expect(pagina.grupo.trim(), `grupo de ${pagina.slug}`).not.toBe('')
      // Una ruta del propio sitio, nunca una dirección de fuera.
      expect(pagina.ruta, `ruta de ${pagina.slug}`).toMatch(/^\/(?!\/)/)
    }
  })

  it('cada sección se despliega y se pliega, y arranca plegada', async () => {
    const user = userEvent.setup()
    montar()

    // Plegadas de entrada: así caben todas las secciones en una pantalla.
    const grupo = PAGINAS_PUBLICAS[0].grupo
    const cabecera = screen.getByRole('button', { name: new RegExp(grupo) })
    expect(cabecera).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: PAGINAS_PUBLICAS[0].nombre })).not.toBeInTheDocument()

    await user.click(cabecera)
    expect(cabecera).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('link', { name: PAGINAS_PUBLICAS[0].nombre })).toBeInTheDocument()

    await user.click(cabecera)

    expect(cabecera).toHaveAttribute('aria-expanded', 'false')
    // El contenido tiene que dejar de estar accesible de verdad, no solo
    // taparse: mientras la transición no termina, sigue en el árbol.
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: PAGINAS_PUBLICAS[0].nombre })).not.toBeInTheDocument()
    })

  })

  it('abrir una sección no toca a las demás', async () => {
    const user = userEvent.setup()
    montar()

    const grupos = seccionesPlegables()
    expect(grupos.length, 'hacen falta al menos dos grupos para que esto pruebe algo').toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: new RegExp(grupos[0]) }))

    expect(screen.getByRole('button', { name: new RegExp(grupos[0]) })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: new RegExp(grupos[1]) })).toHaveAttribute('aria-expanded', 'false')
  })

  it('las subpáginas cuelgan de su página, aunque en el catálogo haya otra por medio', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /Sábado de Pasión/ }))
    await user.click(screen.getByRole('button', { name: /Corporación/ }))

    const madre = screen.getByRole('link', { name: 'Sábado de Pasión' }).closest('li')!
    for (const hija of ['Recorrido', 'Trono', 'Enseres']) {
      expect(within(madre).getByRole('link', { name: hija })).toBeInTheDocument()
    }
    // En el catálogo, Parroquia va entre Historia y Órganos de Gobierno: la
    // subpágina se va con su madre y Parroquia no se lleva nada.
    const historia = screen.getByRole('link', { name: 'Historia' }).closest('li')!
    expect(within(historia).getByRole('link', { name: 'Órganos de Gobierno' })).toBeInTheDocument()
    const parroquia = screen.getByRole('link', { name: /^Parroquia/ }).closest('li')!
    expect(within(parroquia).getAllByRole('link')).toHaveLength(2) // la suya y la de ver en la web
  })

  it('una sección de una sola página con su nombre es ya el enlace, sin plegar', () => {
    montar()
    expect(screen.queryByRole('button', { name: /Rosario/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rosario' })).toHaveAttribute('href', '/cms/paginas/rosario')
  })

  it('el menú lleva al índice, y el índice y las páginas dejan pasar a los mismos cargos', () => {
    const entrada = itemsMenu.find((item) => item.label === 'Páginas')
    expect(entrada?.href).toBe('/cms/paginas')
    // Si el índice dejara entrar a quien no puede abrir ninguna página, sería
    // una lista de enlaces que todos le rebotan.
    expect(rolesPorRutaCms.paginas).toEqual(rolesPorRutaCms['paginas/:slug'])
  })
})
