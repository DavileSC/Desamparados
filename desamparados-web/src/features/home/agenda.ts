import type { ApiEvent, EventoCalendario } from '../../lib/api/events'
import { GRANATE } from './estilos'

export { GOLD, SERIF } from './estilos'

/** Nombre y color de cada tipo de acto; los colores van sobre el papel de la tarjeta de la agenda. */
export const TIPOS: Record<ApiEvent['type'], { nombre: string; color: string }> = {
  CULTO: { nombre: 'Culto', color: GRANATE },
  PROCESION: { nombre: 'Procesión', color: '#a03d44' },
  FORMACION: { nombre: 'Formación', color: '#7a6420' },
  SOCIAL: { nombre: 'Convivencia', color: '#4f5b63' },
  ENSAYO: { nombre: 'Ensayo', color: '#7b757a' },
  REUNION: { nombre: 'Reunión', color: '#7b757a' },
  OTRO: { nombre: 'Otro', color: '#7b757a' },
}

// Las fechas se construyen con año, mes y día, nunca sumando milisegundos:
// así el cambio de hora de octubre no descuadra ningún día.
export function inicioDelDia(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

export function inicioDeMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

export function sumarMeses(mes: Date, cuantos: number) {
  return new Date(mes.getFullYear(), mes.getMonth() + cuantos, 1)
}

/**
 * Los 42 días de la rejilla: seis semanas desde el lunes de la primera, dure el mes cuatro,
 * cinco o seis. Siempre seis para que el calendario no cambie de alto al pasar de mes.
 */
export function diasDeLaRejilla(mes: Date) {
  const desfase = (new Date(mes.getFullYear(), mes.getMonth(), 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), 1 - desfase + i))
}

/** Si el acto ocupa ese día: un triduo del 20 al 22 cubre el 20, el 21 y el 22. */
export function cubreElDia(evento: EventoCalendario, dia: Date) {
  const d = inicioDelDia(dia).getTime()
  return inicioDelDia(evento.start).getTime() <= d && d <= inicioDelDia(evento.end ?? evento.start).getTime()
}

/** «Octubre», o «Abril 2027» cuando hace falta el año. */
export function nombreDelMes(fecha: Date, conAnio: boolean) {
  const mes = fecha.toLocaleDateString('es-ES', { month: 'long' })
  const nombre = mes.charAt(0).toUpperCase() + mes.slice(1)
  return conAnio ? `${nombre} ${fecha.getFullYear()}` : nombre
}
