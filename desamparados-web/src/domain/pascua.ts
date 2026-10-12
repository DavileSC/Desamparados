/**
 * El Domingo de Resurrección, que se mueve cada año: de él cuelgan la
 * Cuaresma y la Semana Santa del retablo y las tandas del Inicio. Se calcula
 * en vez de escribirse a mano para no tener que tocar el código cada enero.
 * (El día de cada salida, en cambio, no se calcula aquí: lo guarda la tabla
 * de salidas de cada corporación.)
 *
 * Todas las fechas son medianoche LOCAL, no UTC: son fechas de calendario, se
 * comparan con el día de hoy del navegador y se enseñan con
 * `toLocaleDateString`. Con medianoche UTC, en Madrid saldrían un día antes
 * durante el horario de verano.
 */

/** Domingo de Pascua por el algoritmo de Meeus/Butcher (calendario gregoriano). */
export function pascua(anio: number): Date {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}
