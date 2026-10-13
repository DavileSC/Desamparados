/**
 * Los días y las horas del Grupo se escriben y se leen en hora de Madrid, sea
 * cual sea la zona del equipo de quien edita o de quien mira.
 *
 * `new Date('2027-03-20T18:00')` toma la zona del navegador: desde Canarias, o
 * desde un portátil que se quedó en otra zona, un reparto de 18:00 se guardaba
 * a las 19:00 de Madrid sin que nadie lo viera. Pasó primero en la ficha de la
 * salida (11359334) y seguía igual en los repartos, los cabildos y la Agenda;
 * por eso las dos direcciones viven aquí y se usan en todos.
 */

const ZONA = 'Europe/Madrid'

/**
 * El instante de una fecha y hora de Madrid (`AAAA-MM-DDTHH:mm`), sea cual sea
 * la zona de quien mira: el Sábado de Pasión sale a las 18:00 de Málaga
 * también para quien lo sigue desde Buenos Aires.
 */
export function instanteEnMadrid(fecha: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(fecha)
  if (!partes) return null
  const [anio, mes, dia, hora, minuto] = partes.slice(1).map(Number)
  const comoUtc = Date.UTC(anio, mes - 1, dia, hora, minuto)
  // El desfase se mide dos veces porque la primera es en un instante que no es
  // el buscado (la hora escrita tomada como UTC). La madrugada de los domingos
  // del cambio de hora cae entre los dos la frontera, y la 01:30 salía con una
  // hora de error; medido otra vez en el instante ya corregido, sale el bueno.
  const aproximado = comoUtc - desfaseEnMadrid(comoUtc)
  return comoUtc - desfaseEnMadrid(aproximado)
}

const formatoReloj = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})

/**
 * Lo que adelanta el reloj de Madrid a UTC en un instante: una hora en
 * invierno, dos en verano.
 */
function desfaseEnMadrid(instante: number): number {
  const enMadrid = formatoReloj.formatToParts(new Date(instante))
  const valor = (tipo: string) => Number(enMadrid.find((p) => p.type === tipo)?.value)
  return Date.UTC(valor('year'), valor('month') - 1, valor('day'), valor('hour'), valor('minute')) - instante
}

/**
 * Lo mismo, como ISO para la API. Un campo que no es una fecha y hora lanza un
 * error que se puede enseñar tal cual, como hacía `new Date(campo).toISOString()`
 * (pero con un mensaje legible en vez de «Invalid time value»).
 */
export function isoEnMadrid(fecha: string): string {
  const instante = instanteEnMadrid(fecha)
  if (instante === null) throw new Error('El día y la hora no son válidos.')
  return new Date(instante).toISOString()
}

const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
const formatoHora = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** El día de un instante en Madrid, como lo pide un `<input type="date">`. */
export const diaEnMadrid = (instante: string | Date) => formatoDia.format(new Date(instante))

/** Su hora en Madrid, como la pide un `<input type="time">`. */
export const horaEnMadrid = (instante: string | Date) => formatoHora.format(new Date(instante))

/** Un instante como «AAAA-MM-DDTHH:mm» en hora de Madrid, para un campo datetime-local. */
export const aCampoFechaMadrid = (instante: string | Date) => `${diaEnMadrid(instante)}T${horaEnMadrid(instante)}`

/**
 * El día de Madrid de un instante, como fecha del calendario: la medianoche de
 * este navegador de ese día. La rejilla de los calendarios y sus casillas son
 * días sueltos, sin hora (`new Date(año, mes, día)`); un acto a las 00:30 del 3
 * en Madrid es del día 3 también desde Canarias, donde aún es el 2.
 */
export function diaDelCalendario(instante: string | Date): Date {
  const [anio, mes, dia] = diaEnMadrid(instante).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/** Hoy en Madrid, como fecha del calendario. */
export const hoyDelCalendario = (ahora: Date = new Date()) => diaDelCalendario(ahora)

const dosCifras = (n: number) => String(n).padStart(2, '0')

/**
 * El instante en que empieza en Madrid un día del calendario: lo que se manda a
 * la API para pedir los actos «desde hoy» o desde el día 1 de un mes.
 */
export function comienzoEnMadrid(dia: Date): Date {
  return new Date(isoEnMadrid(`${dia.getFullYear()}-${dosCifras(dia.getMonth() + 1)}-${dosCifras(dia.getDate())}T00:00`))
}

/** Un instante en texto, en español y en hora de Madrid: «sábado, 24 de octubre». */
export const fechaEnMadrid = (instante: string | Date, opciones: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-ES', { ...opciones, timeZone: ZONA }).format(new Date(instante))
