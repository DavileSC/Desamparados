/**
 * La estación de penitencia del Grupo Parroquial es el Sábado de Pasión: ocho
 * días antes del Domingo de Resurrección, que se mueve cada año. Se calcula en
 * vez de escribirse a mano para no tener que tocar el código cada enero.
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

/** Sábado de Pasión de ese año: Pascua menos ocho días. */
export function sabadoDePasion(anio: number): Date {
  const domingo = pascua(anio)
  // El constructor de Date normaliza un día negativo al mes anterior.
  return new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() - 8)
}

export interface CuentaAtrasEstacion {
  /** La próxima estación de penitencia. */
  fecha: Date
  /** La última celebrada: marca el principio del curso. */
  anterior: Date
  /** Días que faltan; 0 el mismo día. */
  dias: number
  /** Parte del curso recorrida desde la estación anterior, de 0 a 100. */
  porcentaje: number
}

const DIA_EN_MS = 24 * 60 * 60 * 1000
/** La fecha sin hora, para restar días sin que el cambio de hora estorbe. */
const soloDia = (f: Date) => Date.UTC(f.getFullYear(), f.getMonth(), f.getDate())

export function cuentaAtrasEstacion(hoy: Date): CuentaAtrasEstacion {
  const deEsteAnio = sabadoDePasion(hoy.getFullYear())
  // El mismo día de la estación todavía cuenta como «hoy es la estación».
  const yaPasó = soloDia(hoy) > soloDia(deEsteAnio)
  const fecha = yaPasó ? sabadoDePasion(hoy.getFullYear() + 1) : deEsteAnio
  const anterior = yaPasó ? deEsteAnio : sabadoDePasion(hoy.getFullYear() - 1)

  const dias = Math.round((soloDia(fecha) - soloDia(hoy)) / DIA_EN_MS)
  const curso = soloDia(fecha) - soloDia(anterior)
  const recorrido = soloDia(hoy) - soloDia(anterior)
  const porcentaje = Math.min(100, Math.max(0, Math.round((recorrido / curso) * 100)))

  return { fecha, anterior, dias, porcentaje }
}
