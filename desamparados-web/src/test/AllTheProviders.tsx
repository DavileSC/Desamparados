import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import theme from '../theme'
import { crearQueryClientDePruebas } from './queryClient'

export default function AllTheProviders({ children, ruta = '/', modulos }: { children: React.ReactNode; ruta?: string; modulos?: readonly string[] }) {
  const queryClient = crearQueryClientDePruebas(modulos)

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
