import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
// Tipografías auto-alojadas: evitan la petición a Google Fonts (RGPD) y la dependencia del CDN
// Variables: un solo fichero por alfabeto cubre todos los pesos. Exo 2 es la
// de la web pública y Saira la del CMS (ver designTokens.fonts).
import '@fontsource-variable/exo-2'
// Con el eje de anchura: las cifras del Inicio van en Saira estrecha.
import '@fontsource-variable/saira/wdth.css'
import './index.css'
import App from './App.tsx'
import theme from './theme'
import { quitarMetaEstaticas } from './lib/metaEstaticas'
import { recargarAlFallarUnTrozo } from './lib/recargaTrasDespliegue'
import { avisarSinInstalacion, faltaInstalacion } from './config/instalacion'

quitarMetaEstaticas()
recargarAlFallarUnTrozo()

const raiz = document.getElementById('root')!

// Sin los datos de la corporación (/instalacion.js) no se monta nada: la web
// saldría con el nombre en blanco en los títulos y en los textos legales.
if (faltaInstalacion) {
  avisarSinInstalacion(raiz)
} else {
  createRoot(raiz).render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
}
