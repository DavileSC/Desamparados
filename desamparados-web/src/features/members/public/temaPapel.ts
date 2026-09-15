import { createTheme, type Theme } from '@mui/material/styles'
import theme from '../../../theme'
import { GRANATE, PAPEL } from '../../home/estilos'

/** Tinta del texto sobre el papel, la misma que la tarjeta de la agenda. */
export const TINTA_SOBRE_PAPEL = '#1b1c1a'
/** Filete entre bloques del pliego y tramos pendientes de la barra de pasos. */
export const FILETE_PAPEL = '#e3dccf'
/** Borde de los campos en reposo y al pasar el ratón. */
const BORDE_CAMPO = '#cfc6b9'
const BORDE_CAMPO_HOVER = '#8f8578'

/**
 * Botón secundario sobre el papel («Atrás», «Escribir a Secretaría»). El
 * `outline` de AppButton está pensado para tinta: su borde casi blanco no se
 * ve sobre el papel.
 */
export const BOTON_PAPEL_SECUNDARIO = {
  borderRadius: '3px',
  color: 'text.primary',
  borderColor: BORDE_CAMPO,
  '&:hover': { color: 'primary.main', borderColor: 'primary.main', backgroundColor: 'transparent' },
} as const

/**
 * Tema del pliego de papel donde va el formulario de alta.
 *
 * La web pública va en modo oscuro, y un TextField de MUI sobre un fondo claro
 * hereda de ahí texto blanco, etiquetas blancas y estados de foco pensados para
 * tinta: invisible todo. Igual que hace el CMS en `theme/cms.ts`, se redefine
 * la paleta entera (texto, acciones, divisor) y no solo el `mode`, porque
 * `createTheme(base, cambios)` fusiona sin recalcular lo derivado.
 *
 * El granate es el único acento: foco de campo, casilla marcada, tramo hecho
 * de la barra de pasos y botón. Es el color de la acción en toda la web, no
 * un adorno del papel.
 */
export const temaPapel: Theme = createTheme(theme, {
  palette: {
    mode: 'light',
    background: { default: PAPEL, paper: PAPEL },
    primary: { main: GRANATE, dark: '#5a131c', light: '#8a2a35', contrastText: '#ffffff' },
    text: {
      primary: TINTA_SOBRE_PAPEL,
      secondary: '#5e5860',
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
    error: { main: '#a8232b', dark: '#7d161d', light: '#d4535b', contrastText: '#ffffff' },
    success: { main: '#1f7a4d', dark: '#155a38', light: '#4ea378', contrastText: '#ffffff' },
    action: {
      active: 'rgba(0, 0, 0, 0.54)',
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(0, 0, 0, 0.08)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
      focus: 'rgba(0, 0, 0, 0.12)',
    },
    divider: FILETE_PAPEL,
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          // Campo blanco sobre papel crudo: se ve dónde se escribe sin
          // necesitar un borde grueso.
          backgroundColor: '#ffffff',
          borderRadius: 3,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDE_CAMPO },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: BORDE_CAMPO_HOVER },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        // Alineado con el borde del campo, no con el texto de dentro.
        root: { marginLeft: 0, marginRight: 0 },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: { marginLeft: -9, marginRight: 0, alignItems: 'flex-start' },
      },
    },
  },
})
