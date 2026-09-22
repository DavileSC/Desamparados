import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import HermanosAdminPage from '../HermanosAdminPage'
import HermanoEditPage from '../HermanoEditPage'
import { useAuthStore } from '../../altas/auth/store'

/**
 * Editar una ficha y volver tiene que dejar el listado donde estaba. Antes no:
 * `PantallaEdicion` navegaba a una ruta fija y los cinco consumidores le pasaban
 * un literal, así que se editaba la ficha 214 desde la página 5 del censo y se
 * aterrizaba en la página 1. Eso incumplía el punto 4 de la comprobación final
 * del plan de paginación y anulaba el argumento con el que `usePaginacion`
 * justifica meter la página en la URL.
 *
 * Se comprueba la cadena entera —el enlace de editar lleva la consulta, la
 * pantalla de edición la devuelve— porque cada mitad por separado pasaría con
 * la otra rota.
 */
const ficha = {
  id: 214, nombre: 'Rocío', apellidos: 'Gómez Marín', dni: '20000001R',
  fechaNacimiento: '1985-04-12T00:00:00.000Z', email: 'demo.1@ejemplo.invalido', telefono: '600111222',
  direccion: 'Calle Victoria, 14', poblacion: 'Málaga', codigoPostal: '29012',
  activo: true, numeroHermano: 118, fechaAlta: '2019-02-10T00:00:00.000Z', fechaBaja: null,
  esTitular: true, tieneTunicaPropia: false, tunica: 'M', alturaHombro: 168, puesto: 'Nazareno de cirio',
}

const CONSULTA = '?pagina=5&porPagina=50'

/**
 * Una `Response` nueva por llamada: su cuerpo solo se puede leer una vez y aquí
 * se encadenan varias peticiones (censo, solicitudes y la ficha).
 */
function responder() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: RequestInfo | URL) => {
    const ruta = String(url)
    // El censo viene en su página 5 de 5: si `meta` dijera menos páginas, el
    // Paginador reescribiría la URL y el test comprobaría otra cosa.
    const cuerpo = ruta.includes('/solicitudes')
      ? { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
      : ruta.includes('/search')
        ? { data: [ficha], meta: { total: 250, page: 5, limit: 50, totalPages: 5 } }
        : ficha
    return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))
}

/** Las dos rutas de verdad: la de edición usa `useBlocker` y exige data router. */
function montar(entrada: string) {
  const router = createMemoryRouter(
    [
      { path: '/cms/hermanos', element: <HermanosAdminPage /> },
      { path: '/cms/hermanos/:id/editar', element: <HermanoEditPage /> },
    ],
    { initialEntries: [entrada] },
  )
  // El listado refresca los contadores del menú al recargar el censo, y para eso
  // pide el cliente de consultas: este montaje no usa `renderWithProviders`, así
  // que el proveedor lo pone aquí. Uno nuevo por montaje, sin reintentos.
  const clienteConsultas = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <HelmetProvider>
      <QueryClientProvider client={clienteConsultas}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  return router
}

beforeEach(() => {
  useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'secre@ejemplo.es', role: 'SECRETARIA', perfiles: [], origen: 'cms' }, hermano: null })
  responder()
})

afterEach(() => { vi.unstubAllGlobals() })

describe('volver de editar no pierde la página del listado', () => {
  it('se edita desde la página 5 del censo y al cancelar se vuelve a la página 5', async () => {
    const usuario = userEvent.setup()
    const router = montar(`/cms/hermanos${CONSULTA}`)

    // Primero se abre la ficha al lado de la lista; desde ella se edita.
    await usuario.click(await screen.findByRole('link', { name: /gómez marín, rocío/i }))
    await usuario.click(await screen.findByRole('link', { name: /editar rocío gómez marín/i }))
    await screen.findByDisplayValue('Rocío')

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    // Vuelve a la página 5, y con la misma ficha abierta.
    expect(router.state.location.pathname).toBe('/cms/hermanos')
    expect(router.state.location.search).toBe(`${CONSULTA}&ficha=214`)
  })

  it('quien llega tecleando la URL, sin state, vuelve al listado pelado', async () => {
    // No hay página a la que volver: inventarse una sería peor que la primera.
    const usuario = userEvent.setup()
    const router = montar('/cms/hermanos/214/editar')

    await screen.findByDisplayValue('Rocío')
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(router.state.location.pathname).toBe('/cms/hermanos')
    expect(router.state.location.search).toBe('')
  })
})
