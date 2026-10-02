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
  // `setQueryData` crea la consulta con el `gcTime: 0` de arriba: si nadie se
  // suscribe en ese mismo tick (un componente que lee useModulos() tras un
  // await, como un fetch simulado o un lazy), React Query la recolecta y
  // `getQueryData` vuelve a dar `undefined`. El `gcTime: Infinity` de
  // `useModulos` no evita esto: solo se aplica cuando ya hay un observador.
  // Fijar aquí los valores por defecto de esta clave hace que la propia
  // consulta nazca con ellos, sobreviva sin observadores y no haya ninguna
  // pantalla que acabe pidiendo /modulos al `fetch` simulado del test.
  queryClient.setQueryDefaults(CLAVE_MODULOS, { gcTime: Infinity, staleTime: Infinity })
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
