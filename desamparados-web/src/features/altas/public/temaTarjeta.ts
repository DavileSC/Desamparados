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
  backgroundColor: 'rgba(12, 11, 13, 0.66)',
  backdropFilter: 'blur(16px) saturate(120%)',
  WebkitBackdropFilter: 'blur(16px) saturate(120%)',
  boxShadow: '0 30px 60px -30px rgba(0, 0, 0, 0.8)',
} as const

/**
 * Ajustes del formulario sobre la tarjeta. El tema de la web ya es oscuro y
 * trae un rojo de error legible sobre tinta (ERROR_SOBRE_OSCURO); aquí solo
 * se corrige lo que la tarjeta cambia de los campos.
 */
export const temaTarjeta: Theme = createTheme(theme, {
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
