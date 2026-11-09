import { FONDOS, MARCA } from '../../../theme/marca'

/*
 * Los colores y la semana de la hoja del calendario, aparte de los
 * componentes: los usan el calendario y su esqueleto, y un fichero de
 * componentes que exporta también constantes rompe la recarga en caliente.
 */

export const PAPEL = FONDOS.almanaque
/**
 * El granate del Grupo en la hoja: el principal de la marca, con su suelo de
 * contraste sobre este papel y sobre el rosa, que son más oscuros que el
 * blanco donde lo tiene `MARCA.principal`.
 */
export const GRANATE = MARCA.principalAlmanaque
export const RAYA = '#d9cfc1'
export const GRIS = '#7a6c70'
export const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
export const SEMANA_LARGA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
/** La fila con los nombres de los días, que va dentro de lo medido. */
export const CABECERA_SEMANA = 32
