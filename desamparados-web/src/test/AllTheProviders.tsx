import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '../theme'
import { CLAVES_MODULO } from '../domain/modulos'
import { CLAVE_MODULOS } from '../lib/api/modulos'

export default function AllTheProviders({ children, ruta = '/', modulos }: { children: React.ReactNode; ruta?: string; modulos?: readonly string[] }) {
  // Un cliente nuevo por render: si se compartiera, la caché de un test
  // contaminaría al siguiente. Sin reintentos, o los fallos tardan segundos.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  // Los módulos encendidos, ya en caché: ninguna pantalla tiene que pedirlos
  // (los tests simulan `fetch` para lo suyo y no sabrían responder a
  // /modulos). Sin `modulos`, todo encendido, que es como está esta instalación.
  queryClient.setQueryData(CLAVE_MODULOS, [...(modulos ?? CLAVES_MODULO)])

  return (
    <MemoryRouter initialEntries={[ruta]}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}
