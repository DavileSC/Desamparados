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
import BloqueFotoTexto from './BloqueFotoTexto'
import BloqueCita from './BloqueCita'
import BloqueVideo from './BloqueVideo'
import BloqueBotones from './BloqueBotones'
import BloquePreguntas from './BloquePreguntas'
import BloqueDescargas from './BloqueDescargas'
import BloqueMapa from './BloqueMapa'
import BloqueCuentaAtras from './BloqueCuentaAtras'
import BloqueEspacio from './BloqueEspacio'
import BloqueFotoFija from './BloqueFotoFija'
import BloqueHorario from './BloqueHorario'
import BloqueDibujo from './BloqueDibujo'
import BloqueAnillos from './BloqueAnillos'
import BloquePuertas from './BloquePuertas'
import BloquePrograma from './BloquePrograma'
import BloqueRelacion from './BloqueRelacion'
import BloqueCarrusel from './BloqueCarrusel'
import { valorDe } from './presentacion'
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
  fotoTexto: BloqueFotoTexto as ComponentType<{ bloque: never }>,
  cita: BloqueCita as ComponentType<{ bloque: never }>,
  video: BloqueVideo as ComponentType<{ bloque: never }>,
  botones: BloqueBotones as ComponentType<{ bloque: never }>,
  preguntas: BloquePreguntas as ComponentType<{ bloque: never }>,
  descargas: BloqueDescargas as ComponentType<{ bloque: never }>,
  mapa: BloqueMapa as ComponentType<{ bloque: never }>,
  cuentaAtras: BloqueCuentaAtras as ComponentType<{ bloque: never }>,
  espacio: BloqueEspacio as ComponentType<{ bloque: never }>,
  fotoFija: BloqueFotoFija as ComponentType<{ bloque: never }>,
  horario: BloqueHorario as ComponentType<{ bloque: never }>,
  dibujo: BloqueDibujo as ComponentType<{ bloque: never }>,
  anillos: BloqueAnillos as ComponentType<{ bloque: never }>,
  puertas: BloquePuertas as ComponentType<{ bloque: never }>,
  programa: BloquePrograma as ComponentType<{ bloque: never }>,
  relacion: BloqueRelacion as ComponentType<{ bloque: never }>,
  carrusel: BloqueCarrusel as ComponentType<{ bloque: never }>,
}

export const componenteDeBloque = (bloque: Bloque) => REGISTRO_BLOQUES[bloque.tipo]

/**
 * Los bloques que pintan su propio título. El listado lo necesita porque sus
 * versiones cortas llevan al lado el enlace al listado entero («Ver todas las
 * noticias»), que va dentro del mismo encabezado. El dibujo lo pone en la
 * columna del texto, al lado del dibujo y no encima de los dos. El programa lo
 * lleva con el año al otro lado; la relación, con el mandato; y la foto con
 * texto fundida, sobre la foto.
 */
const CON_TITULO_PROPIO = new Set(['listado', 'dibujo', 'programa', 'relacion'])

export const pintaSuTitulo = (bloque: Bloque) =>
  CON_TITULO_PROPIO.has(bloque.tipo) || (bloque.tipo === 'fotoTexto' && valorDe(bloque, 'estilo') === 'fundido')
  // En foco, el título va dentro, pequeño y en oro, sobre las tres palabras.
  || (bloque.tipo === 'anillos' && valorDe(bloque, 'disposicion') === 'foco')
