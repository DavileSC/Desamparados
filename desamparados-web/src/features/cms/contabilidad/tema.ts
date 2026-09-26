import { GRAFICAS_CMS, SUPERFICIES_CMS, segunModo } from '../../../theme/cms'

/**
 * Los colores de las gráficas y tablas de la contabilidad. Antes iban fijos,
 * pensados para el claro: en oscuro, la cabecera del libro de caja salía en
 * blanco sobre casi blanco y las cifras de la gráfica, en casi negro sobre
 * negro.
 *
 * Valen para los dos modos a la vez (variables CSS y `segunModo`): al cambiar
 * de modo no hay que volver a pintar nada. Funcionan también fuera del
 * proveedor del CMS, como en las pruebas: ahí se ven en claro.
 */
const COLORES = {
  graficas: GRAFICAS_CMS,
  texto: SUPERFICIES_CMS.texto,
  texto2: SUPERFICIES_CMS.texto2,
  /** Fondo de la cabecera y el pie de una tabla: un escalón sobre la tarjeta. */
  fondoCabecera: segunModo('#faf8f5', 'rgba(255,255,255,0.04)'),
  /** Carril vacío de una barra de reparto. */
  carril: segunModo('#f1eeea', 'rgba(255,255,255,0.08)'),
  /** El detalle al pasar el ratón va siempre oscuro; en oscuro, con borde para separarse de la tarjeta. */
  emergente: segunModo('#1b1c1a', '#070608'),
  emergenteBorde: segunModo('transparent', 'rgba(204,196,201,0.18)'),
}

export function useColoresContabilidad() {
  return COLORES
}
