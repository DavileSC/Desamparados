/**
 * Concuerda el número con lo que nombra. El panel enseña cifras que muy a
 * menudo valen uno —un grupo pequeño, un mes flojo— y «1 hermanos activos»
 * canta en cuanto se mira.
 */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export default contar
