import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
// Tipografías auto-alojadas: evitan la petición a Google Fonts (RGPD) y la dependencia del CDN
// Variables: un solo fichero por alfabeto cubre todos los pesos. Exo 2 es la
// de la web pública y Saira la del CMS (ver designTokens.fonts).
import '@fontsource-variable/exo-2'
import '@fontsource-variable/saira'
import './index.css'
import App from './App.tsx'
import theme from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
