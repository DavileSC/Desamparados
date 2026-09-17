import type { ComponentType } from 'react'
import BloqueTexto from './BloqueTexto'
import BloqueFoto from './BloqueFoto'
import BloqueTarjetas from './BloqueTarjetas'
import type { Bloque } from '../../lib/api/contenido'

/**
 * Qué componente pinta cada tipo de bloque.
 *
 * Los tipos salen de `shared/tipos-de-bloque.json`, que comparten el servidor y
 * la web. El test de este directorio comprueba que aquí está declarado cada uno
 * de los tipos de esa lista: sin él, añadir un bloque en el servidor y olvidar
 * su componente dejaría un hueco en blanco en la página sin que nada fallara.
 */
export const REGISTRO_BLOQUES: Record<string, ComponentType<{ bloque: never }>> = {
  texto: BloqueTexto as ComponentType<{ bloque: never }>,
  foto: BloqueFoto as ComponentType<{ bloque: never }>,
  tarjetas: BloqueTarjetas as ComponentType<{ bloque: never }>,
}

export const componenteDeBloque = (bloque: Bloque) => REGISTRO_BLOQUES[bloque.tipo]
