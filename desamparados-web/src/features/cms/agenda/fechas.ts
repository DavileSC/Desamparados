import type { ApiEvent } from '../../../lib/api/agenda'
import { inicioDelDia, nombreDelMes } from '../../inicio/agenda'

/** «18:00». */
export const hora = (fecha: Date) => fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

/** «sáb», sin el punto que ponen algunos motores. */
export const diaSemana = (fecha: Date) => fecha.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')

/** El final, si el acto acaba otro día (un triduo); si acaba el mismo día, nada. */
export function finEnOtroDia(evento: Pick<ApiEvent, 'startDate' | 'endDate'>): Date | null {
  if (!evento.endDate) return null
  const fin = new Date(evento.endDate)
  return inicioDelDia(fin).getTime() !== inicioDelDia(new Date(evento.startDate)).getTime() ? fin : null
}

/** Los actos de una página en apartados por mes, en el orden en que llegan: «Octubre», «Enero 2027». */
export function agruparPorMes<E extends Pick<ApiEvent, 'startDate'>>(eventos: E[], hoy = new Date()) {
  const grupos: { clave: string; titulo: string; eventos: E[] }[] = []
  for (const evento of eventos) {
    const inicio = new Date(evento.startDate)
    const clave = `${inicio.getFullYear()}-${inicio.getMonth()}`
    const ultimo = grupos.at(-1)
    if (ultimo?.clave === clave) ultimo.eventos.push(evento)
    else grupos.push({ clave, titulo: nombreDelMes(inicio, inicio.getFullYear() !== hoy.getFullYear()), eventos: [evento] })
  }
  return grupos
}

/** «hoy», «mañana», «el sábado», «el 12 de octubre»: cuándo es el siguiente acto, dicho como se diría. */
export function cuandoEs(iso: string, ahora = new Date()): string {
  const fecha = new Date(iso)
  const dias = Math.round((inicioDelDia(fecha).getTime() - inicioDelDia(ahora).getTime()) / 86_400_000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias > 1 && dias < 7) return `el ${fecha.toLocaleDateString('es-ES', { weekday: 'long' })}`
  return `el ${fecha.getDate()} de ${fecha.toLocaleDateString('es-ES', { month: 'long' })}`
}
