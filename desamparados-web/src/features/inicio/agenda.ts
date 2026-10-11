import type { ApiEvent, EventoCalendario } from '../../lib/api/agenda'
import { GRANATE } from './estilos'

export {  SERIF } from './estilos'

/**
 * Nombre y color de cada tipo de acto, uno distinto por tipo: la agenda de la
 * portada, la del CMS y el Inicio usan estos. `color` va sobre papel claro;
 * `oscuro`, la misma familia aclarada, sobre los fondos oscuros del CMS.
 */
export const TIPOS: Record<ApiEvent['type'], { nombre: string; color: string; oscuro: string }> = {
  CULTO: { nombre: 'Culto', color: GRANATE, oscuro: '#ff9fa6' },
  PROCESION: { nombre: 'Procesión', color: '#5b2a86', oscuro: '#c6a3f0' },
  FORMACION: { nombre: 'Formación', color: '#2b5d8c', oscuro: '#8fc0ef' },
  ENSAYO: { nombre: 'Ensayo', color: '#a0501a', oscuro: '#f2a66e' },
  REUNION: { nombre: 'Reunión', color: '#4f5b63', oscuro: '#c2ccd3' },
  SOCIAL: { nombre: 'Convivencia', color: '#3d6b37', oscuro: '#9fd394' },
  OTRO: { nombre: 'Otro', color: '#836700', oscuro: '#e3c65a' },
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
