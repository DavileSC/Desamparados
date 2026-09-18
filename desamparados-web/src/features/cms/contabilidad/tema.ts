import { useTheme } from '@mui/material'
import { graficasCms } from '../../../theme/cms'

/**
 * Los colores de las gráficas y tablas de la contabilidad en el modo en que
 * esté el CMS. Antes iban fijos, pensados para el claro: en oscuro, la
 * cabecera del libro de caja salía en blanco sobre casi blanco y las cifras
 * de la gráfica, en casi negro sobre negro.
 *
 * Sale del tema de MUI y no de `useTemaCms`: así funciona también fuera del
 * proveedor del CMS, como en las pruebas.
 */
export function useColoresContabilidad() {
  const theme = useTheme()
  const oscuro = theme.palette.mode === 'dark'
  return {
    oscuro,
    graficas: graficasCms(oscuro ? 'oscuro' : 'claro'),
    texto: theme.palette.text.primary,
    texto2: theme.palette.text.secondary,
    /** Fondo de la cabecera y el pie de una tabla: un escalón sobre la tarjeta. */
    fondoCabecera: oscuro ? 'rgba(255,255,255,0.04)' : '#faf8f5',
    /** Carril vacío de una barra de reparto. */
    carril: oscuro ? 'rgba(255,255,255,0.08)' : '#f1eeea',
    /** El detalle al pasar el ratón va siempre oscuro; en oscuro, con borde para separarse de la tarjeta. */
    emergente: oscuro ? '#100e11' : '#1b1c1a',
    emergenteBorde: oscuro ? 'rgba(204,196,201,0.18)' : 'none',
  }
}
