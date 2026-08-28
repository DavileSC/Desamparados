import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '../theme'

export default function AllTheProviders({ children }: { children: React.ReactNode }) {
  // Un cliente nuevo por render: si se compartiera, la caché de un test
  // contaminaría al siguiente. Sin reintentos, o los fallos tardan segundos.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
