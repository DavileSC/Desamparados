/**
 * Lo que comparten los formularios de bloque: la forma de sus props y las dos
 * piezas que usa más de uno.
 */

export type Props<T> = { bloque: T; onCambio: (cambios: Partial<T>) => void }

/**
 * Claves estables para las filas de las listas de un bloque (la galería, la
 * cronología, `ListaEditable`…).
 *
 * Hacen falta porque muchas filas llevan algo con estado propio: un
 * `CampoImagen` mientras sube una foto, las horas del horario. Con la
 * posición por clave, React reutiliza cada instancia en su sitio al reordenar
 * en vez de moverla: una subida en vuelo terminaría escribiendo su ruta en el
 * medio que hubiera pasado a ocupar esa posición, y la foto acabaría en otra
 * fila. Es el mismo problema que está anotado en `BloquesDePagina.tsx`, y se
 * resuelve igual que en `bloques/filas.ts`: un contador de módulo que reparte
 * claves que no se repiten.
 *
 * La lista de claves va en paralelo a la de filas y se mueve en los mismos
 * manejadores (subir, bajar, quitar, añadir); al pintar se cae a la posición
 * si faltara alguna.
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
