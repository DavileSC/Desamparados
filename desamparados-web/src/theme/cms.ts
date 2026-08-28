import { createTheme } from '@mui/material/styles'
import theme, { designTokens } from './index'

/**
 * Tema del CMS: lienzo claro sobre el mismo juego de tokens que la web pública.
 *
 * Se aplica con un ThemeProvider anidado dentro de AdminLayout, así que la web
 * pública no se entera. Redefine la paleta entera, los estados interactivos y el
 * texto deshabilitado en lugar de fusionar parcialmente: heredar sobre un
 * `mode: 'dark'` deja esos tres grupos en blancos de baja opacidad, invisibles
 * sobre fondo claro. Esto afecta el hover, la selección y foco de botones,
 * MenuItem, ListItemButton, filas de tabla, y el texto deshabilitado.
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
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
    action: {
      active: 'rgba(0, 0, 0, 0.54)',
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(0, 0, 0, 0.08)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
      focus: 'rgba(0, 0, 0, 0.12)',
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
