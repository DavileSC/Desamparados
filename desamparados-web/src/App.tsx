import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { MotionConfig } from 'framer-motion'
import AppRouter from './routes'
import ErrorBoundary from './components/ErrorBoundary'
import { useCargarSesion } from './features/members/auth/session'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  // Recupera la sesion de la cookie httpOnly. Una sola vez, al arrancar.
  useCargarSesion()

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        {/* Respeta prefers-reduced-motion del sistema en todas las animaciones */}
        <MotionConfig reducedMotion="user">
          {/* Envuelve al router para que un fallo de render muestre un aviso
              en vez de dejar la página en blanco. */}
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  )
}

export default App
