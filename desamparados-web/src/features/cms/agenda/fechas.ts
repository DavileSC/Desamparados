import type { ApiEvent } from '../../../lib/api/agenda'
import { diaDelCalendario, diaEnMadrid, fechaEnMadrid, horaEnMadrid, hoyDelCalendario } from '../../../lib/horaDeMadrid'
import { nombreDelMes } from '../../inicio/agenda'

// Los actos se leen en hora de Madrid, como en la Agenda pública: quien edita
// desde Canarias (o con el portátil en otra zona) veía la vigilia de las 00:30
// del 3 a las 23:30 del 2, en otro día que el que sale en la web.

/** «18:00», en Madrid. */
export const hora = (fecha: Date) => horaEnMadrid(fecha)

/** «sáb», sin el punto que ponen algunos motores; el día de Madrid. */
export const diaSemana = (fecha: Date) => fechaEnMadrid(fecha, { weekday: 'short' }).replace('.', '')

/** El número del día en Madrid: «3». */
export const diaDelMes = (fecha: Date) => Number(diaEnMadrid(fecha).slice(8))

/** El final, si el acto acaba otro día (un triduo); si acaba el mismo día, nada. */
export function finEnOtroDia(evento: Pick<ApiEvent, 'startDate' | 'endDate'>): Date | null {
  if (!evento.endDate) return null
  const fin = new Date(evento.endDate)
  return diaEnMadrid(fin) !== diaEnMadrid(evento.startDate) ? fin : null
}

/**
 * Lo que al acto le falta y en la web se nota: sin lugar, la línea bajo el
 * título se queda en la hora; sin descripción, al abrirlo no sale nada.
 */
export const loQueFalta = (evento: Pick<ApiEvent, 'location' | 'description'>) =>
  [!evento.location?.trim() && 'Sin lugar', !evento.description?.trim() && 'Sin descripción'].filter(Boolean) as string[]

/** Los actos de una página en apartados por mes, en el orden en que llegan: «Octubre», «Enero 2027». */
export function agruparPorMes<E extends Pick<ApiEvent, 'startDate'>>(eventos: E[], ahora = new Date()) {
  const grupos: { clave: string; titulo: string; eventos: E[] }[] = []
  const anioDeHoy = hoyDelCalendario(ahora).getFullYear()
  for (const evento of eventos) {
    const dia = diaDelCalendario(evento.startDate)
    const clave = `${dia.getFullYear()}-${dia.getMonth()}`
    const ultimo = grupos.at(-1)
    if (ultimo?.clave === clave) ultimo.eventos.push(evento)
    else grupos.push({ clave, titulo: nombreDelMes(dia, dia.getFullYear() !== anioDeHoy), eventos: [evento] })
  }
  return grupos
}

/** «hoy», «mañana», «el sábado», «el 12 de octubre»: cuándo es el siguiente acto, dicho como se diría. */
export function cuandoEs(iso: string, ahora = new Date()): string {
  // Días del calendario de Madrid; redondeado, porque un cambio de hora en medio
  // deja la diferencia en 23 o 25 horas.
  const dias = Math.round((diaDelCalendario(iso).getTime() - hoyDelCalendario(ahora).getTime()) / 86_400_000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias > 1 && dias < 7) return `el ${fechaEnMadrid(iso, { weekday: 'long' })}`
  return `el ${fechaEnMadrid(iso, { day: 'numeric', month: 'long' })}`
}
