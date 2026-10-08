import { use, type ComponentType } from 'react'
import BloqueTexto from './BloqueTexto'
import BloqueFoto from './BloqueFoto'
import BloqueTarjetas from './BloqueTarjetas'
import BloqueLlamada from './BloqueLlamada'
import BloqueDatos from './BloqueDatos'
import BloqueItinerario from './BloqueItinerario'
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
import BloqueAnillos from './BloqueAnillos'
import BloquePuertas from './BloquePuertas'
import BloquePrograma from './BloquePrograma'
import BloqueRelacion from './BloqueRelacion'
import { valorDe } from './presentacion'
import type { Bloque } from '../../lib/api/contenido'

type ComponenteDeBloque = ComponentType<{ bloque: never }>

interface BloquePerezoso {
  Componente: ComponenteDeBloque
  cargar: () => Promise<void>
  listo: () => boolean
}

/**
 * Un bloque que se descarga aparte, la primera vez que una página lo lleva.
 *
 * Todos juntos pesaban unos 42 KB comprimidos, y los bajaba cualquier página
 * de bloques aunque fuera solo texto y fotos. Los que van aquí son los grandes
 * (el calendario del listado, la cronología, el carrusel, el formulario de
 * contacto con react-hook-form y zod…); los pequeños siguen dentro.
 *
 * No es `React.lazy` porque aquel suspende siempre la primera vez que se pinta
 * cada sitio, aunque el código ya esté descargado: un instante en blanco que
 * cambiaría el alto de la página. Este, una vez cargado, pinta directamente, y
 * `ConBloquesCargados` lo descarga antes de enseñar la página.
 */
function perezoso(importar: () => Promise<{ default: unknown }>): BloquePerezoso {
  let cargado: ComponenteDeBloque | null = null
  let promesa: Promise<void> | null = null
  const cargar = () => (promesa ??= importar().then(
    (modulo) => { cargado = modulo.default as ComponenteDeBloque },
    // Si falla (un despliegue nuevo borró el trozo, la red), se olvida para
    // que el siguiente intento vuelva a pedirlo en vez de fallar para siempre.
    (error: unknown) => { promesa = null; throw error },
  ))
  // El registro es de constantes y este componente es parte de una: si cambia
  // este fichero, el fast refresh recarga la página, que es lo que conviene.
  // eslint-disable-next-line react/only-export-components
  function Perezoso(props: { bloque: never }) {
    // `use` admite llamarse con condición: solo suspende si aún no ha llegado.
    if (!cargado) use(cargar())
    const Componente = cargado as ComponenteDeBloque
    // eslint-disable-next-line react/static-components -- es el componente del módulo descargado, siempre el mismo
    return <Componente {...props} />
  }
  return { Componente: Perezoso, cargar, listo: () => cargado !== null }
}

const PEREZOSOS: Record<string, BloquePerezoso> = {
  galeria: perezoso(() => import('./BloqueGaleria')),
  cronologia: perezoso(() => import('./BloqueCronologia')),
  listado: perezoso(() => import('./BloqueListado')),
  contacto: perezoso(() => import('./BloqueContacto')),
  horario: perezoso(() => import('./BloqueHorario')),
  dibujo: perezoso(() => import('./BloqueDibujo')),
  carrusel: perezoso(() => import('./BloqueCarrusel')),
  donativo: perezoso(() => import('./BloqueDonativo')),
}

const enCurso = new Map<string, Promise<void>>()

/**
 * La descarga de los bloques perezosos que llevan estos bloques, o `null` si ya
 * están todos. La misma promesa para los mismos tipos: `use` la necesita
 * estable entre renders.
 */
export function cargarBloques(bloques: Bloque[]): Promise<void> | null {
  const faltan = [...new Set(bloques.map((bloque) => bloque.tipo))]
    .filter((tipo) => PEREZOSOS[tipo] && !PEREZOSOS[tipo].listo())
    .sort()
  if (faltan.length === 0) return null
  const clave = faltan.join()
  let promesa = enCurso.get(clave)
  if (!promesa) {
    promesa = Promise.all(faltan.map((tipo) => PEREZOSOS[tipo].cargar())).then(() => undefined)
    enCurso.set(clave, promesa)
    promesa.catch(() => undefined).finally(() => enCurso.delete(clave))
  }
  return promesa
}

/**
 * Qué componente pinta cada tipo de bloque.
 *
 * Los tipos salen de `shared/tipos-de-bloque.json`, que comparten el servidor y
 * la web. El test de este directorio comprueba que aquí está declarado cada uno
 * de los tipos de esa lista: sin él, añadir un bloque en el servidor y olvidar
 * su componente dejaría un hueco en blanco en la página sin que nada fallara.
 */
export const REGISTRO_BLOQUES: Record<string, ComponenteDeBloque> = {
  texto: BloqueTexto as ComponenteDeBloque,
  foto: BloqueFoto as ComponenteDeBloque,
  galeria: PEREZOSOS.galeria.Componente,
  tarjetas: BloqueTarjetas as ComponenteDeBloque,
  llamada: BloqueLlamada as ComponenteDeBloque,
  datos: BloqueDatos as ComponenteDeBloque,
  itinerario: BloqueItinerario as ComponenteDeBloque,
  cronologia: PEREZOSOS.cronologia.Componente,
  listado: PEREZOSOS.listado.Componente,
  contacto: PEREZOSOS.contacto.Componente,
  fotoTexto: BloqueFotoTexto as ComponenteDeBloque,
  cita: BloqueCita as ComponenteDeBloque,
  video: BloqueVideo as ComponenteDeBloque,
  botones: BloqueBotones as ComponenteDeBloque,
  preguntas: BloquePreguntas as ComponenteDeBloque,
  descargas: BloqueDescargas as ComponenteDeBloque,
  mapa: BloqueMapa as ComponenteDeBloque,
  cuentaAtras: BloqueCuentaAtras as ComponenteDeBloque,
  espacio: BloqueEspacio as ComponenteDeBloque,
  fotoFija: BloqueFotoFija as ComponenteDeBloque,
  horario: PEREZOSOS.horario.Componente,
  dibujo: PEREZOSOS.dibujo.Componente,
  anillos: BloqueAnillos as ComponenteDeBloque,
  puertas: BloquePuertas as ComponenteDeBloque,
  programa: BloquePrograma as ComponenteDeBloque,
  relacion: BloqueRelacion as ComponenteDeBloque,
  carrusel: PEREZOSOS.carrusel.Componente,
  donativo: PEREZOSOS.donativo.Componente,
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
