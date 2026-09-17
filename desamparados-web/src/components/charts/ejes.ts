/** Paso de eje redondo: 1, 2, 2,5 o 5 por la potencia de diez que toque. */
export function pasoBonito(bruto: number): number {
  if (bruto <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  return ([1, 2, 2.5, 5, 10].find((f) => f * potencia >= bruto) ?? 10) * potencia
}

/** Eje que arranca en cero con marcas redondas, unas cuatro divisiones. */
export function escalaDesdeCero(maximo: number): { techo: number; marcas: number[] } {
  if (maximo <= 0) return { techo: 1, marcas: [0, 1] }
  const paso = pasoBonito(maximo / 4)
  const techo = paso * Math.ceil(maximo / paso)
  return { techo, marcas: Array.from({ length: Math.round(techo / paso) + 1 }, (_, i) => i * paso) }
}

/** Columna apoyada en la base con los dos cantos del extremo redondeados. */
export function columna(x: number, base: number, tope: number, ancho: number): string {
  const alto = Math.abs(base - tope)
  if (alto < 0.5) return ''
  const haciaAbajo = tope > base
  const r = Math.min(4, alto, ancho / 2)
  return haciaAbajo
    ? `M${x},${base} H${x + ancho} V${tope - r} Q${x + ancho},${tope} ${x + ancho - r},${tope} H${x + r} Q${x},${tope} ${x},${tope - r} Z`
    : `M${x},${base} V${tope + r} Q${x},${tope} ${x + r},${tope} H${x + ancho - r} Q${x + ancho},${tope} ${x + ancho},${tope + r} V${base} Z`
}

/**
 * Cada cuántas etiquetas del eje X se pinta una. Con doce meses en la pantalla
 * de un móvil no caben todas y se solapan: se calcula con el sitio que hay, así
 * que en una tarjeta ancha salen todas y en una estrecha, una de cada dos o tres.
 */
export function pasoEtiquetas(cuantas: number, anchoUtil: number, minimoPorEtiqueta = 30): number {
  if (cuantas <= 1 || anchoUtil <= 0) return 1
  return Math.max(1, Math.ceil(cuantas / Math.max(1, Math.floor(anchoUtil / minimoPorEtiqueta))))
}
