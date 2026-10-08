import { cargarBloques } from '../components/bloques/registro'
import TIPOS from '../../../shared/tipos-de-bloque.json'
import type { Bloque } from '../lib/api/contenido'

/**
 * Descarga ya todos los bloques perezosos. Para las pruebas que miran cómo se
 * pinta una página de bloques y no su descarga: con la suite entera en marcha,
 * el `import()` de un bloque puede tardar más que la espera de un `findBy`.
 */
export const precargarBloques = () => cargarBloques(TIPOS.tipos.map((tipo) => ({ tipo }) as Bloque))
