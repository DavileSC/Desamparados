import type { Coordenada } from '../lib/api/contenido'
import ruta from './ruta.json'

/**
 * El recorrido del Rosario vespertino de 2026, tal como lo dibujó el usuario
 * en Google My Maps («Mapa sin nombre.kmz», 17-10-2026). Sale del templo, en
 * C. Corregidor Antonio de Bobadilla, y vuelve a él por Paz y Guzmán: el
 * orden de las esquinas (ruta.json) es el del cortejo. No va en el CMS
 * porque esta página es una prueba de un día, aparte de la web.
 */
export const RUTA = ruta as Coordenada[]

/**
 * Las calles por las que va, una por tramo de la línea: `esquina` es la de
 * RUTA donde empieza, y acaba donde empieza la siguiente. Sacadas de la línea
 * con el mapa del barrio (callesDeLaLinea) y repasadas por el usuario contra
 * el cartel (17-10-2026): el tramo en diagonal entre Bobadilla e Iznate es el
 * primer cruce de la avenida, y Río Duratón y la plaza de Río Trabancos van en
 * el mismo tramo, con el nombre de la calle.
 */
export const CALLES: { nombre: string; esquina: number; cruce?: boolean }[] = [
  { nombre: 'C. Corregidor Antonio de Bobadilla', esquina: 0 },
  { nombre: 'Cruce de Ortega y Gasset', esquina: 1, cruce: true },
  { nombre: 'C. Iznate', esquina: 2 },
  { nombre: 'C. Coronel Osuna', esquina: 3 },
  { nombre: 'C. Valle de Abdalajís', esquina: 4 },
  { nombre: 'C. Alozaina', esquina: 5 },
  { nombre: 'C. Ciudad de Andújar', esquina: 6 },
  { nombre: 'C. Río Duratón', esquina: 7 },
  { nombre: 'C. Río Águeda', esquina: 8 },
  { nombre: 'C. Alozaina', esquina: 9 },
  { nombre: 'C. Ciudad de Andújar', esquina: 10 },
  { nombre: 'C. Coronel Osuna', esquina: 11 },
  { nombre: 'C. Mijas', esquina: 12 },
  { nombre: 'Cruce de Ortega y Gasset', esquina: 13, cruce: true },
  { nombre: 'C. Corregidor Ruiz de Pereda', esquina: 14 },
  { nombre: 'C. Río Cabrera', esquina: 15 },
  { nombre: 'Plaza de Nuestra Señora del Carmen', esquina: 16 },
  { nombre: 'C. Río Boeza', esquina: 17 },
  { nombre: 'C. Corregidor Ruiz de Pereda', esquina: 18 },
  { nombre: 'C. Corregidor Paz y Guzmán', esquina: 19 },
  { nombre: 'C. Corregidor Antonio de Bobadilla', esquina: 20 },
]
