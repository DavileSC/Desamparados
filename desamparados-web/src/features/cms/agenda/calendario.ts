import type { ApiEvent } from '../../../lib/api/agenda'
import { comienzoEnMadrid, diaDelCalendario, hoyDelCalendario } from '../../../lib/horaDeMadrid'
import { colorDelTipo, veloDelTipo } from './tiposEvento'

/**
 * «2026-10-03», el de una fecha del calendario (sin hora): la clave de cada
 * casilla y el `?dia=` de la URL. Un instante de la API pasa antes por
 * `diaDelCalendario`, que lo lleva a su día de Madrid.
 */
export const claveDia = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`

/** «2026-10», el mes de la URL. */
export const claveMes = (fecha: Date) => claveDia(fecha).slice(0, 7)

/** El primer día del mes de `?mes=2026-10`; si falta o no vale, el de hoy en Madrid. */
export function leerMes(valor: string, ahora = new Date()): Date {
  const [anio, mes] = /^(\d{4})-(\d{2})$/.test(valor) ? valor.split('-').map(Number) : []
  const hoy = hoyDelCalendario(ahora)
  return anio && mes >= 1 && mes <= 12 ? new Date(anio, mes - 1, 1) : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
}

/** El día de `?dia=2026-10-03`, o null si no es una fecha. */
export function leerDia(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  return fecha.getMonth() === mes - 1 ? fecha : null
}

/**
 * Las casillas del mes, de lunes a domingo, con los días de los meses de al
 * lado que completan la primera y la última semana. `desde` y `hasta` son lo
 * que se le pide al servidor: la medianoche de Madrid de la primera casilla y
 * la que sigue a la última (la del navegador dejaba fuera, desde Canarias, el
 * acto de las 00:30 del primer día).
 * Los días se hacen con año, mes y día, nunca sumando milisegundos: así el
 * cambio de hora de octubre no descuadra ninguno.
 */
export function rejillaDelMes(primero: Date) {
  const anio = primero.getFullYear()
  const mes = primero.getMonth()
  const hueco = (primero.getDay() + 6) % 7
  const semanas = Math.ceil((hueco + new Date(anio, mes + 1, 0).getDate()) / 7)
  const dias = Array.from({ length: semanas * 7 }, (_, i) => new Date(anio, mes, 1 - hueco + i))
  const ultimo = dias[dias.length - 1]
  return { dias, desde: comienzoEnMadrid(dias[0]), hasta: comienzoEnMadrid(new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + 1)) }
}

/** Dónde cae un día en un acto de varios: el primero, uno de en medio o el último. `solo` si es de un día. */
export type Tramo = 'solo' | 'ini' | 'medio' | 'fin'

/**
 * Los actos de cada casilla, en el orden en que llegan (por la hora a la que
 * empiezan), cada uno en su día de Madrid. Un triduo sale en sus tres días,
 * como en la lista (`finEnOtroDia`).
 */
export function actosPorDia<E extends Pick<ApiEvent, 'startDate' | 'endDate'>>(eventos: E[], dias: Date[]) {
  const porDia = new Map<string, { evento: E; tramo: Tramo }[]>(dias.map((d) => [claveDia(d), []]))
  for (const evento of eventos) {
    const inicio = diaDelCalendario(evento.startDate)
    const fin = evento.endDate ? diaDelCalendario(evento.endDate) : inicio
    for (let d = inicio; d <= fin; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const lista = porDia.get(claveDia(d))
      if (!lista) continue
      const tramo: Tramo = fin.getTime() === inicio.getTime() ? 'solo' : d.getTime() === inicio.getTime() ? 'ini' : d.getTime() === fin.getTime() ? 'fin' : 'medio'
      lista.push({ evento, tramo })
    }
  }
  return porDia
}

/** «Septiembre de 2026». */
export const tituloDelMes = (primero: Date) => {
  const mes = primero.toLocaleDateString('es-ES', { month: 'long' })
  return `${mes[0].toUpperCase()}${mes.slice(1)} de ${primero.getFullYear()}`
}

/** El color del tipo, velado para el fondo y entero para el filete, en los dos modos. */
export function colores(tipo: ApiEvent['type']) {
  return { fondo: veloDelTipo(tipo), filete: colorDelTipo(tipo) }
}
