import type { PanelResponse } from '../../../lib/api/panel'
import { cuentaAtrasEstacion, pascua } from '../../../domain/sabadoDePasion'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** «20 mar 2027» */
export const corta = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
const diaMes = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]}`
const soloDia = (f: Date) => Date.UTC(f.getFullYear(), f.getMonth(), f.getDate())

export interface Parada { p: number; titulo: string; fecha: string }

/**
 * Las paradas del curso: las dos estaciones, los próximos actos que caen
 * dentro y el Miércoles de Ceniza. Si dos quedan casi encima, se queda la
 * primera: con las etiquetas pisándose no se lee ninguna.
 */
export function paradasDelCurso(hoy: Date, eventos: PanelResponse['actividad']['proximosEventos']): Parada[] {
  const { fecha, anterior } = cuentaAtrasEstacion(hoy)
  const curso = soloDia(fecha) - soloDia(anterior)
  const posicion = (f: Date) => (soloDia(f) - soloDia(anterior)) / curso
  const domingo = pascua(fecha.getFullYear())
  const ceniza = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() - 46)

  const intermedias: Parada[] = [
    ...eventos
      .map((e) => ({ f: new Date(e.startDate), titulo: e.title }))
      .filter(({ f }) => posicion(f) > 0 && posicion(f) < 1)
      .slice(0, 3)
      .map(({ f, titulo }) => ({ p: posicion(f), titulo, fecha: diaMes(f) })),
    { p: posicion(ceniza), titulo: 'Miércoles de Ceniza', fecha: diaMes(ceniza) },
  ].sort((a, b) => a.p - b.p)

  const elegidas: Parada[] = [{ p: 0, titulo: 'Sábado de Pasión', fecha: corta(anterior) }]
  for (const parada of intermedias) {
    if (parada.p - elegidas[elegidas.length - 1].p >= 0.08 && 1 - parada.p >= 0.08) elegidas.push(parada)
  }
  elegidas.push({ p: 1, titulo: 'Sábado de Pasión', fecha: corta(fecha) })
  return elegidas
}
