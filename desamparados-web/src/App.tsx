import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { MotionConfig } from 'framer-motion'
import AppRouter from './routes'
import RedDeErrores from './components/RedDeErrores'
import { useCargarSesion, useVaciarCacheAlCambiarDeUsuario } from './features/altas/auth/session'
import { portadaDelInicio } from './lib/api/portada'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/*
 * Entrando por la portada, sus datos se piden ya, a la vez que se baja su
 * trozo de código: si no, la petición esperaba a que llegara y se pintara, y
 * la foto del héroe (la que más tarda en verse) iba un salto más tarde. Misma
 * clave y mismo tiempo que `usePortada`, que la encuentra hecha o en camino.
 */
if (window.location.pathname === '/') {
  void queryClient.prefetchQuery({ queryKey: ['home', 'portada'], queryFn: portadaDelInicio, staleTime: 5 * 60_000 })
}

function App() {
  // Recupera la sesion de la cookie httpOnly. Una sola vez, al arrancar.
  useCargarSesion()
  useVaciarCacheAlCambiarDeUsuario(queryClient)

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        {/* Respeta prefers-reduced-motion del sistema en todas las animaciones */}
        <MotionConfig reducedMotion="user">
          {/* Envuelve al router para que un fallo de render muestre un aviso
              en vez de dejar la página en blanco. */}
          <RedDeErrores>
            <AppRouter />
          </RedDeErrores>
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  )
}

export default App
