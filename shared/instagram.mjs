// El pie de una noticia en Instagram: lo que propone el CMS y lo que Instagram
// rechazaría. Compartido porque la web lo enseña mientras se escribe y la API
// lo vuelve a mirar antes de mandar, con el mismo mensaje. Sin dependencias.

export const LARGO_MAXIMO_PIE = 2200
export const ETIQUETAS_MAXIMAS = 30
export const MENCIONES_MAXIMAS = 20

/**
 * El título, el extracto y dónde leer el resto. En Instagram los enlaces del
 * pie no se pueden pulsar: no se pone la dirección de la noticia sino que
 * está en el perfil, que es lo que se hace allí.
 */
export function pieDeInstagram({ titulo, extracto }) {
  const partes = [titulo.trim()]
  if (extracto?.trim()) partes.push(extracto.trim())
  partes.push('La noticia completa, en el enlace de nuestro perfil.')
  return partes.join('\n\n').slice(0, LARGO_MAXIMO_PIE)
}

/** Lo que Instagram rechazaría del pie, dicho para quien lo escribe; null si vale. */
export function problemaDelPie(pie) {
  if (pie.trim() === '') return 'El pie no puede ir vacío.'
  if (pie.length > LARGO_MAXIMO_PIE) return `El pie pasa de ${LARGO_MAXIMO_PIE} caracteres, el máximo de Instagram.`
  const etiquetas = pie.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0
  if (etiquetas > ETIQUETAS_MAXIMAS) return `El pie lleva ${etiquetas} etiquetas (#) y Instagram admite ${ETIQUETAS_MAXIMAS}.`
  const menciones = pie.match(/@[\p{L}\p{N}._]+/gu)?.length ?? 0
  if (menciones > MENCIONES_MAXIMAS) return `El pie menciona a ${menciones} cuentas (@) y Instagram admite ${MENCIONES_MAXIMAS}.`
  return null
}

/** La foto más alta (4:5) y la más apaisada (1,91:1) que admite. */
export const PROPORCION_MINIMA = 4 / 5
export const PROPORCION_MAXIMA = 1.91
