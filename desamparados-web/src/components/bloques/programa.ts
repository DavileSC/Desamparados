import type { EventoCalendario } from '../../lib/api/agenda'
import type { FilaDePrograma } from '../../lib/api/contenido'

/** Los actos de la Agenda que cuentan como culto del programa. */
const TIPOS_DE_CULTO: ReadonlySet<EventoCalendario['type']> = new Set(['CULTO', 'PROCESION'])

interface Proximo {
  /** La posición de la fila en el programa. */
  indice: number
  /** El primer culto de la Agenda en ese mes, si ya está anunciado. */
  acto: EventoCalendario | null
}

const RELOJ = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric' })

/** Año y mes (1–12) de una fecha en hora de Madrid. */
function anioYMes(fecha: Date): { anio: number; mes: number } {
  const partes = RELOJ.formatToParts(fecha)
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  return { anio: valor('year'), mes: valor('month') }
}

/**
 * La fila que toca: la del primer mes, desde el actual, que tenga una en el
 * programa. Del mes en curso solo vale si en la Agenda queda un culto por
 * delante (si el Rosario ya pasó, el próximo es el de noviembre); de los meses
 * que vienen vale siempre, aunque la Agenda aún no tenga la fecha.
 *
 * Las filas sin mes fijo («Cada mes») no son nunca la próxima: serían siempre
 * ellas. Todo en hora de Madrid, como el horario de la Parroquia.
 */
export function proximaFila(filas: FilaDePrograma[], actos: EventoCalendario[], ahora = new Date()): Proximo | null {
  const hoy = anioYMes(ahora)
  const cultos = actos
    .filter((acto) => TIPOS_DE_CULTO.has(acto.type) && acto.start.getTime() >= ahora.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  for (let salto = 0; salto < 12; salto++) {
    const mes = ((hoy.mes - 1 + salto) % 12) + 1
    const anio = hoy.anio + (hoy.mes - 1 + salto >= 12 ? 1 : 0)
    const indice = filas.findIndex((fila) => fila.mes === mes)
    if (indice === -1) continue
    const acto = cultos.find((c) => {
      const cuando = anioYMes(c.start)
      return cuando.anio === anio && cuando.mes === mes
    }) ?? null
    if (salto === 0 && !acto) continue
    return { indice, acto }
  }
  return null
}

/** «Sábado, 17 de octubre · 20:00», en hora de Madrid. */
export function fechaDelActo(acto: EventoCalendario): string {
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' }).format(acto.start)
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(acto.start)
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora}`
}

/** El año en que cae una fecha, en hora de Madrid: el Grupo lleva su año de enero a diciembre. */
export function anioDe(ahora = new Date()): string {
  return String(anioYMes(ahora).anio)
}
