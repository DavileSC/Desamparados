import { createTheme } from '@mui/material/styles'
import theme, { designTokens } from './index'

/**
 * Tema del CMS: lienzo claro sobre el mismo juego de tokens que la web pública.
 *
 * Se aplica con un ThemeProvider anidado dentro de AdminLayout, así que la web
 * pública no se entera. Redefine la paleta entera en lugar de fusionar cuatro
 * campos: heredar un `mode: 'dark'` a medias deja textos claros sobre fondo
 * claro en los componentes que consultan el modo.
 */
export const cmsSurfaces = {
  canvas: '#f4f2ee',
  card: '#ffffff',
  hairline: '#e3dfda',
  sidebar: designTokens.colors.primary, // #100e11
}

export const cmsTheme = createTheme(theme, {
  palette: {
    mode: 'light',
    background: { default: cmsSurfaces.canvas, paper: cmsSurfaces.card },
    text: {
      primary: designTokens.colors.onSurface,
      secondary: designTokens.colors.onSurfaceVariant,
    },
    divider: cmsSurfaces.hairline,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${cmsSurfaces.hairline}`,
        },
      },
    },
  },
})

export default cmsTheme
