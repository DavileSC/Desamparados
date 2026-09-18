import type { ComponentType } from 'react'
import BloqueTexto from './BloqueTexto'
import BloqueFoto from './BloqueFoto'
import BloqueGaleria from './BloqueGaleria'
import BloqueTarjetas from './BloqueTarjetas'
import BloqueLlamada from './BloqueLlamada'
import BloqueDatos from './BloqueDatos'
import BloqueItinerario from './BloqueItinerario'
import BloqueCronologia from './BloqueCronologia'
import BloqueListado from './BloqueListado'
import BloqueContacto from './BloqueContacto'
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
  galeria: BloqueGaleria as ComponentType<{ bloque: never }>,
  tarjetas: BloqueTarjetas as ComponentType<{ bloque: never }>,
  llamada: BloqueLlamada as ComponentType<{ bloque: never }>,
  datos: BloqueDatos as ComponentType<{ bloque: never }>,
  itinerario: BloqueItinerario as ComponentType<{ bloque: never }>,
  cronologia: BloqueCronologia as ComponentType<{ bloque: never }>,
  listado: BloqueListado as ComponentType<{ bloque: never }>,
  contacto: BloqueContacto as ComponentType<{ bloque: never }>,
}

export const componenteDeBloque = (bloque: Bloque) => REGISTRO_BLOQUES[bloque.tipo]

/**
 * Los bloques que pintan su propio título. El listado lo necesita porque sus
 * versiones cortas llevan al lado el enlace al listado entero («Ver todas las
 * noticias»), que va dentro del mismo encabezado.
 */
const CON_TITULO_PROPIO = new Set(['listado'])

export const pintaSuTitulo = (bloque: Bloque) => CON_TITULO_PROPIO.has(bloque.tipo)
