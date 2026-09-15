import { createTheme, type Theme } from '@mui/material/styles'
import theme from '../../../theme'

/** Filete entre bloques de la tarjeta y tramos pendientes de la barra de pasos. */
export const FILETE_TARJETA = 'rgba(204, 196, 201, 0.2)'
/** Borde de los campos en reposo y al pasar el ratón: algo más visible que el de serie, que sobre foto se pierde. */
const BORDE_CAMPO = 'rgba(204, 196, 201, 0.38)'
const BORDE_CAMPO_HOVER = 'rgba(204, 196, 201, 0.7)'

/**
 * Tarjeta tintada y translúcida sobre la foto velada, como la de la pantalla
 * de acceso: sin borde de color, separada del fondo por el tinte y el
 * desenfoque. Bordes rectos, como los bloques de la portada.
 */
export const TARJETA = {
  backgroundColor: 'rgba(29, 27, 30, 0.66)',
  backdropFilter: 'blur(16px) saturate(120%)',
  WebkitBackdropFilter: 'blur(16px) saturate(120%)',
  boxShadow: '0 30px 60px -30px rgba(0, 0, 0, 0.8)',
} as const

/**
 * Ajustes del formulario sobre la tarjeta. El tema de la web ya es oscuro;
 * aquí solo se corrige lo que sobre tinta no se lee: el rojo de error de
 * serie (#ba1a1a) queda a 2,6:1 sobre la tarjeta, y los avisos de un
 * formulario son justo lo que hay que poder leer.
 */
export const temaTarjeta: Theme = createTheme(theme, {
  palette: {
    error: { main: '#f08a84', dark: '#d9655e', light: '#f7b1ac', contrastText: '#1d1b1e' },
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 3,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDE_CAMPO },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: BORDE_CAMPO_HOVER },
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
