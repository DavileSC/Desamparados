// Los titulares de la corporación: uno (el Grupo) o varios (el Cristo y la
// Virgen de tantas cofradías), en orden; el primero es el principal. Sin
// dependencias de Node: lo usan la API, la web en el navegador y el validador
// del fichero de la instalación.

/** «A», «A y B», «A, B y C»: como se nombran juntos en un membrete o una frase. */
export function unirTitulares(titulares) {
  if (titulares.length <= 1) return titulares[0] ?? ''
  return `${titulares.slice(0, -1).join(', ')} y ${titulares[titulares.length - 1]}`
}

/** La forma que concuerda con cuántos son: «le guarde» o «le guarden». */
export const segunLosTitulares = (titulares, singular, plural) => (titulares.length > 1 ? plural : singular)
