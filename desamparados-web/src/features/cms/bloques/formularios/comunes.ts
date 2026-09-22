/**
 * Lo que comparten los formularios de bloque: la forma de sus props y las dos
 * piezas que usa más de uno.
 */

export type Props<T> = { bloque: T; onCambio: (cambios: Partial<T>) => void }

/**
 * Claves estables para las filas de la galería y de la cronología.
 *
 * Hacen falta en estas dos y no en las tarjetas porque sus filas llevan
 * `CampoImagen`, que guarda estado propio mientras sube una foto. Con la
 * posición por clave, React reutiliza cada instancia en su sitio al reordenar
 * en vez de moverla: una subida en vuelo terminaría escribiendo su ruta en el
 * medio que hubiera pasado a ocupar esa posición, y la foto acabaría en otra
 * fila. Es el mismo problema que está anotado en `BloquesDePagina.tsx`, y se
 * resuelve igual que en `bloques/filas.ts`: un contador de módulo que reparte
 * claves que no se repiten.
 *
 * La lista de claves va en paralelo a `bloque.medios` y se mueve en los mismos
 * manejadores. No puede desajustarse porque este formulario es el único que
 * toca esa lista; aun así, al pintar se cae a la posición si faltara alguna.
 */
let ultimaClave = 0
const siguienteClave = () => ++ultimaClave

/** Copia de la lista con dos posiciones cambiadas. */
function intercambiar<T>(lista: T[], indice: number, destino: number): T[] {
  const copia = [...lista]
  copia[indice] = lista[destino]
  copia[destino] = lista[indice]
  return copia
}

export { siguienteClave, intercambiar }
