/**
 * Las frases de la redacción que se calculan, no se pintan.
 *
 * Aparte de `Listado.tsx` a propósito: ese fichero exporta componentes, y
 * sacar de él una función suelta rompe el *fast refresh* de Vite (aviso
 * `react/only-export-components`), igual que en `bloques/filas.ts`.
 */

/**
 * Lo que dice la raya cuando hay una destacada. La frase de siempre («las 3 más
 * recientes») dejaría de ser verdad: la primera plaza es la que se ha fijado a
 * mano y las otras se siguen llenando por fecha. Sin destacada devuelve
 * `undefined` y la raya usa su frase de siempre.
 */
export function textoPortada(resumen: { portada: { limite: number; fijada: number | null } } | null) {
  if (!resumen?.portada.fijada) return undefined
  const resto = resumen.portada.limite - 1
  return `Hasta aquí sale en la portada: la destacada y ${resto === 1 ? 'la más reciente' : `las ${resto} más recientes`}.`
}
