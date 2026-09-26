import type { BloqueHorario, FranjaDeMisas, TurnoDeDespacho } from '../../lib/api/contenido'

/**
 * Las cuentas del horario vivo: qué hora es en Málaga, si rige el horario de
 * verano, cuál es la próxima misa y si el despacho está abierto. Van aparte
 * del componente para poder probarlas con un reloj fijo.
 */

/** Cuánto dura una misa, para decir «ahora mismo» y no «la próxima» mientras se celebra. */
export const DURACION_MISA = 45

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Un momento en Málaga: el día de la semana (0 domingo), los minutos desde medianoche y el día del año (MM-DD). */
export interface Momento { dia: number; minutos: number; mesDia: string }

const RELOJ_DE_MADRID = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid', hourCycle: 'h23', weekday: 'short', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})
const SEMANA_EN_INGLES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Lo que marca un reloj de Málaga en ese instante, mire desde donde mire quien visita. */
export function momentoEnMadrid(instante: Date): Momento {
  const partes = RELOJ_DE_MADRID.formatToParts(instante)
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return {
    dia: SEMANA_EN_INGLES.indexOf(valor('weekday')),
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
    mesDia: `${valor('month')}-${valor('day')}`,
  }
}

/** «19:00» → 1140. */
export const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))

/** 570 → «9:30»: sin el cero delante, como se escribe un horario. */
export const aHora = (minutos: number) => `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`

/** «09:30» → «9:30». */
export const horaLegible = (hora: string) => aHora(aMinutos(hora))

/** Si ese día del año cae en el verano del horario. El verano puede cruzar el año (de diciembre a enero). */
export function esVerano(verano: BloqueHorario['verano'], mesDia: string): boolean {
  if (verano.desde === '' || verano.hasta === '') return false
  return verano.desde <= verano.hasta
    ? mesDia >= verano.desde && mesDia <= verano.hasta
    : mesDia >= verano.desde || mesDia <= verano.hasta
}

/** Las horas de una franja según la temporada: en verano, las de verano si las tiene. */
export const horasDeFranja = (franja: FranjaDeMisas, verano: boolean) =>
  verano && franja.horasVerano.length > 0 ? franja.horasVerano : franja.horas

/** Las misas de un día, en minutos y en orden, sin repetir. */
function misasDelDia(bloque: BloqueHorario, dia: number, verano: boolean): number[] {
  const horas = bloque.misas
    .filter((franja) => franja.dias.includes(dia))
    .flatMap((franja) => horasDeFranja(franja, verano).map(aMinutos))
  return [...new Set(horas)].sort((a, b) => a - b)
}

/**
 * Una misa respecto a ahora: `enDias` 0 es hoy, 1 mañana; `faltan`, los
 * minutos que quedan (negativo si ya ha empezado y aún se celebra).
 */
export interface MisaProxima { enDias: number; dia: number; minutos: number; faltan: number; enCurso: boolean }

/**
 * La misa que se está celebrando ahora o, si no, la siguiente, buscando hasta
 * una semana adelante. La temporada se mira día a día: la víspera del verano,
 * la de mañana ya va con el horario de verano.
 */
export function proximaMisa(bloque: BloqueHorario, ahora: Date): MisaProxima | null {
  const hoy = momentoEnMadrid(ahora)
  // El mediodía de hoy: sumando días desde ahí, el cambio de hora no hace
  // saltar ni repetir un día, como pasaría sumándolos a las 23:30.
  const mediodia = ahora.getTime() + (720 - hoy.minutos) * 60_000
  for (let enDias = 0; enDias <= 7; enDias++) {
    const ese = enDias === 0 ? hoy : momentoEnMadrid(new Date(mediodia + enDias * 86_400_000))
    const misas = misasDelDia(bloque, ese.dia, esVerano(bloque.verano, ese.mesDia))
    for (const minutos of misas) {
      const faltan = enDias * 1440 + minutos - hoy.minutos
      if (faltan > -DURACION_MISA) return { enDias, dia: ese.dia, minutos, faltan, enCurso: faltan <= 0 }
    }
  }
  return null
}

/** El despacho respecto a ahora: abierto hasta una hora, o cuándo abre. */
export type EstadoDespacho =
  | { abierto: true; hasta: number }
  | { abierto: false; enDias: number; dia: number; desde: number }

export function estadoDelDespacho(turnos: TurnoDeDespacho[], ahora: Date): EstadoDespacho | null {
  if (turnos.length === 0) return null
  const hoy = momentoEnMadrid(ahora)
  const deHoy = turnos.filter((t) => t.dias.includes(hoy.dia))
  const abierto = deHoy.find((t) => aMinutos(t.desde) <= hoy.minutos && hoy.minutos < aMinutos(t.hasta))
  if (abierto) return { abierto: true, hasta: aMinutos(abierto.hasta) }
  for (let enDias = 0; enDias <= 7; enDias++) {
    const dia = (hoy.dia + enDias) % 7
    const aperturas = turnos
      .filter((t) => t.dias.includes(dia))
      .map((t) => aMinutos(t.desde))
      .filter((desde) => enDias > 0 || desde > hoy.minutos)
      .sort((a, b) => a - b)
    if (aperturas.length > 0) return { abierto: false, enDias, dia, desde: aperturas[0] }
  }
  return null
}

/** «hoy», «mañana» o «el martes». */
export const cuando = (enDias: number, dia: number) => (enDias === 0 ? 'hoy' : enDias === 1 ? 'mañana' : `el ${DIAS[dia]}`)

/** «dentro de 25 min», «dentro de 2 h 10 min»; a más de un día, nada: basta con el día. */
export function cuantoFalta(minutos: number): string {
  if (minutos <= 0 || minutos >= 1440) return ''
  if (minutos < 60) return `dentro de ${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `dentro de ${horas} h${resto ? ` ${resto} min` : ''}`
}

/**
 * Los días en palabras, como se escriben en un tablón: «lunes a sábado»,
 * «martes y viernes», «domingos». La semana empieza el lunes.
 */
export function diasEnPalabras(dias: number[]): string {
  const orden = [...new Set(dias)].map((d) => (d + 6) % 7).sort((a, b) => a - b)
  const nombre = (d: number) => DIAS[(d + 1) % 7]
  if (orden.length === 7) return 'todos los días'
  if (orden.length === 1) return orden[0] === 6 ? 'domingos' : `${nombre(orden[0])}${orden[0] === 5 ? 's' : ''}`
  const seguidos = orden.every((d, i) => i === 0 || d === orden[i - 1] + 1)
  if (seguidos && orden.length > 2) return `${nombre(orden[0])} a ${nombre(orden[orden.length - 1])}`
  return `${orden.slice(0, -1).map(nombre).join(', ')} y ${nombre(orden[orden.length - 1])}`
}

/** «07-01» → «1 de julio». */
export function diaDelAnio(mesDia: string): string {
  const [mes, dia] = mesDia.split('-').map(Number)
  return `${dia} de ${MESES[mes - 1] ?? ''}`
}
