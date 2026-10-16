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
