/**
 * Los importes de la web, en un solo sitio: había una docena de formateadores
 * y no coincidían («1234,00 €» en unos, «1.234,00 €» en otros). Todos reciben
 * EUROS; lo que llega en céntimos se divide antes de llamarlos.
 *
 * `useGrouping: 'always'`: el es-ES de Intl no pone el punto de miles hasta los
 * cinco dígitos, y «6998 €» junto a «12.874 €» parece un error.
 */
const conCentimos = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' })
const sinCentimos = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' })

/** Un importe en euros, siempre con céntimos: «1.234,50 €», «12,00 €». */
export const euros = (valor: number) => conCentimos.format(valor)

/** Sin céntimos si son redondos: «10 €», pero «7,50 €». Para cifras de resumen y botones de importe. */
export const eurosRedondos = (valor: number) => (Number.isInteger(valor) ? sinCentimos : conCentimos).format(valor)

/** Lo mismo para lo que la API manda en céntimos (el modelo 182): 123450 → «1.234,50 €». */
export const eurosDeCentimos = (centimos: number) => euros(centimos / 100)
