import { TIPOS } from '../../home/agenda'

/** Los tipos en el orden del desplegable, con el nombre que ve el visitante («Convivencia», no SOCIAL). */
export const TIPOS_EVENTO = (['CULTO', 'PROCESION', 'FORMACION', 'ENSAYO', 'REUNION', 'SOCIAL', 'OTRO'] as const)
  .map((valor) => ({ valor, ...TIPOS[valor] }))
