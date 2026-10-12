import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClientDePruebas } from '../../test/queryClient'
import DireccionAntigua from '../DireccionAntigua'

/** Dónde ha acabado el visitante, dirección entera. */
function Destino() {
  const { pathname, search, hash } = useLocation()
  return <p>en {pathname + search + hash}</p>
}

function entrarEn(direccion: string) {
  const router = createMemoryRouter(
    [
      { path: '/parroquia-pasionistas', element: <DireccionAntigua a="/parroquia" /> },
      { path: '/corporacion/*', element: <DireccionAntigua /> },
      { path: '/actualidad/*', element: <DireccionAntigua /> },
      { path: '/hermanos/*', element: <DireccionAntigua /> },
      { path: '*', element: <Destino /> },
    ],
    { initialEntries: [direccion] },
  )
  render(<QueryClientProvider client={crearQueryClientDePruebas()}><HelmetProvider><RouterProvider router={router} /></HelmetProvider></QueryClientProvider>)
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

  it('la portada de la sección sola, que se quitó, da la página de no encontrada', async () => {
    const router = entrarEn('/corporacion')
    expect(await screen.findByRole('heading', { name: 'Esta calle no está en el recorrido' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/corporacion')
  })
})

describe('una página que cambió de dirección entera', () => {
  it('/parroquia-pasionistas lleva a /parroquia, con su consulta y su ancla', () => {
    // Los enlaces guardados en el CMS llevan anclas (#como-llegar).
    entrarEn('/parroquia-pasionistas?a=1#como-llegar')
    expect(screen.getByText('en /parroquia?a=1#como-llegar')).toBeInTheDocument()
  })
})
