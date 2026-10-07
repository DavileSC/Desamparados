import { segunModo } from '../../../theme/cms'
import type { Prenda } from '../../../lib/api/inventario'

/**
 * Los colores del inventario, en los dos modos. La conservación va en los
 * tonos del Grupo (crema, oro viejo y granate), no en el verde, azul y ámbar
 * de cualquier panel; cada tramo se distingue también por su luminosidad,
 * para quien no distingue bien los tonos.
 */
export const CONSERVACION = {
  optimo: segunModo('#c4a66a', '#d6c49c'),
  bueno: segunModo('#7d6232', '#8f7442'),
  reparar: segunModo('#a8323f', '#e07a85'),
} as const

/**
 * Cada estado de una prenda: el punto (y su texto) y el fondo de la píldora.
 * Apagados a propósito: en el ropero hay muchos a la vez y, a saturación
 * plena, la lista parecía un semáforo.
 */
export const ESTADO_PRENDA: Record<Prenda['estado'], { punto: string; fondo: string }> = {
  DISPONIBLE: { punto: segunModo('#3c7a57', '#8fcaa5'), fondo: segunModo('rgba(60,122,87,0.12)', 'rgba(143,202,165,0.14)') },
  PRESTADA: { punto: segunModo('#3a64a3', '#93b5ea'), fondo: segunModo('rgba(58,100,163,0.11)', 'rgba(147,181,234,0.15)') },
  LAVADO: { punto: segunModo('#67616b', '#c9c3bd'), fondo: segunModo('rgba(103,97,107,0.12)', 'rgba(201,195,189,0.12)') },
  TALLER: { punto: segunModo('#9a6410', '#e6b866'), fondo: segunModo('rgba(154,100,16,0.12)', 'rgba(230,184,102,0.15)') },
  BAJA: { punto: segunModo('#8a848e', '#7b757f'), fondo: 'transparent' },
}
