import topes from '../../../../../../shared/topes-contenido.json'

/** «5, 10, 20» → [5, 10, 20]; null si algo no es un importe entero dentro de los límites o se repite. */
export function leerImportes(texto: string): number[] | null {
  const partes = texto.split(/[,;\s]+/).filter(Boolean)
  if (partes.length === 0 || partes.length > topes.importesPorDonativo) return null
  const importes = partes.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN))
  if (importes.some((n) => !Number.isInteger(n) || n < topes.donativoMinimoEuros || n > topes.donativoMaximoEuros)) return null
  return new Set(importes).size === importes.length ? importes : null
}
