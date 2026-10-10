import { createContext, useContext, useState, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import theme from '../theme'
import { crearQueryClientDePruebas } from './queryClient'

const Hijos = createContext<ReactNode>(null)
const HijosActuales = () => <>{useContext(Hijos)}</>

/**
 * Un router de datos de memoria con la pantalla en cualquier ruta: lo
 * necesitan las que avisan de cambios sin guardar con `useBlocker`, que con
 * `MemoryRouter` lanza. Los hijos van por contexto para que un `rerender`
 * los cambie sin crear otro router (que volvería a la ruta de partida).
 */
function ConRouterDeDatos({ ruta, children }: { ruta: string; children: ReactNode }) {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: <HijosActuales /> }], { initialEntries: [ruta] }))
  return <Hijos.Provider value={children}><RouterProvider router={router} /></Hijos.Provider>
}

export default function AllTheProviders({ children, ruta = '/', modulos, routerDeDatos = false }: { children: ReactNode; ruta?: string; modulos?: readonly string[]; routerDeDatos?: boolean }) {
  const queryClient = crearQueryClientDePruebas(modulos)
  const contenido = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
  return routerDeDatos
    ? <ConRouterDeDatos ruta={ruta}>{contenido}</ConRouterDeDatos>
    : <MemoryRouter initialEntries={[ruta]}>{contenido}</MemoryRouter>
}
