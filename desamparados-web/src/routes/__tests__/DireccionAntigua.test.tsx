import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import DireccionAntigua from '../DireccionAntigua'

/** Dónde ha acabado el visitante, dirección entera. */
function Destino() {
  const { pathname, search, hash } = useLocation()
  return <p>en {pathname + search + hash}</p>
}

function entrarEn(direccion: string) {
  const router = createMemoryRouter(
    [
      { path: '/corporacion/*', element: <DireccionAntigua /> },
      { path: '/actualidad/*', element: <DireccionAntigua /> },
      { path: '/hermanos/*', element: <DireccionAntigua /> },
      { path: '*', element: <Destino /> },
    ],
    { initialEntries: [direccion] },
  )
  render(<HelmetProvider><RouterProvider router={router} /></HelmetProvider>)
  return router
}

describe('las direcciones de antes de quitar las secciones', () => {
  it('llevan a la página, que ya no cuelga de su sección', () => {
    entrarEn('/corporacion/historia/organos-de-gobierno')
    expect(screen.getByText('en /historia/organos-de-gobierno')).toBeInTheDocument()
  })

  it('una noticia conserva su slug', () => {
    entrarEn('/actualidad/noticias/solemne-triduo')
    expect(screen.getByText('en /noticias/solemne-triduo')).toBeInTheDocument()
  })

  it('conserva la consulta y el ancla', () => {
    entrarEn('/actualidad/agenda?ver=cultos#suscripcion')
    expect(screen.getByText('en /agenda?ver=cultos#suscripcion')).toBeInTheDocument()
  })

  it('el acceso de hermanos pasa a /acceso', () => {
    entrarEn('/hermanos/acceso')
    expect(screen.getByText('en /acceso')).toBeInTheDocument()
  })

  it('la portada de la sección sola, que se quitó, da «Página no encontrada»', async () => {
    const router = entrarEn('/corporacion')
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/corporacion')
  })
})
