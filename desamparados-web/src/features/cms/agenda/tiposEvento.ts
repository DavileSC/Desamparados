import type { ApiEvent } from '../../../lib/api/agenda'
import { segunModo } from '../../../theme/cms'
import { TIPOS } from '../../inicio/agenda'
import { MARCA } from '../../../theme/marca'

/** Los tipos en el orden del desplegable, con el nombre que ve el visitante («Convivencia», no SOCIAL). */
export const TIPOS_EVENTO = (['CULTO', 'PROCESION', 'FORMACION', 'ENSAYO', 'REUNION', 'SOCIAL', 'OTRO'] as const)
  .map((valor) => ({ valor, ...TIPOS[valor] }))

/**
 * El color de cada tipo en el CMS claro. Los de la web (`TIPOS[t].color`)
 * son tintas de papel, casi negras en un punto de 9px: Culto, Reunión y Otro
 * no se distinguían. Estos son los mismos tonos que los del modo oscuro
 * (`TIPOS[t].oscuro`), con la fuerza justa para leerse sobre blanco: todos
 * pasan de 3:1 con la tarjeta y con el lienzo.
 */
const EN_CLARO: Record<ApiEvent['type'], string> = {
  CULTO: MARCA.principalPuntoClaro,
  PROCESION: '#8a4fd0',
  FORMACION: '#2f7cc9',
  ENSAYO: '#d2661c',
  REUNION: '#667985',
  SOCIAL: '#3c9448',
  OTRO: '#a88300',
}

/** El color de un tipo en el CMS, en claro y en oscuro (lo elige el navegador, sin volver a pintar). */
export const colorDelTipo = (tipo: ApiEvent['type']) => segunModo(EN_CLARO[tipo], TIPOS[tipo].oscuro)

/** El mismo color velado, para el fondo de un acto o de un día. */
export const veloDelTipo = (tipo: ApiEvent['type'], claro = 11, oscuro = 20) =>
  segunModo(`color-mix(in srgb, ${EN_CLARO[tipo]} ${claro}%, transparent)`, `color-mix(in srgb, ${TIPOS[tipo].oscuro} ${oscuro}%, transparent)`)
