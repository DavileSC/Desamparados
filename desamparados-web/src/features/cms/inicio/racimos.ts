import type { PanelResponse, TipoEvento } from '../../../lib/api/panel'
import { cuentaAtrasEstacion, pascua } from '../../../domain/sabadoDePasion'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** «20 mar 2027» */
export const corta = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
/** «20 mar» */
export const diaMes = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]}`
const soloDia = (f: Date) => Date.UTC(f.getFullYear(), f.getMonth(), f.getDate())
const DIA_EN_MS = 24 * 60 * 60 * 1000

/** El día de calendario (en la hora de España) de un instante ISO, como medianoche local. */
function diaEnMadrid(iso: string): Date {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  )
  return new Date(Number(partes.year), Number(partes.month) - 1, Number(partes.day))
}

export interface Acto {
  fecha: Date
  titulo: string
  tipo: TipoEvento
  /** Posición en el curso, de 0 (la estación anterior) a 1 (la próxima). */
  p: number
  /** Ya ha pasado (hoy todavía no cuenta como pasado). */
  pasado: boolean
}

export interface Racimo {
  actos: Acto[]
  /** Donde va el número: a medio camino entre el primer acto y el último. */
  p: number
  /** Le queda algún acto por delante. */
  porVenir: boolean
}

/** Días a partir de los cuales dos actos seguidos ya no van en el mismo racimo. */
export const DIAS_DE_RACIMO = 10

/**
 * Todos los actos del curso, en orden, con el Miércoles de Ceniza aunque no
 * esté en la Agenda: sin él, la Cuaresma no se ve empezar en el camino.
 */
export function actosDelCurso(hoy: Date, eventos: PanelResponse['curso']['eventos']): Acto[] {
  const { fecha, anterior } = cuentaAtrasEstacion(hoy)
  const curso = soloDia(fecha) - soloDia(anterior)
  const posicion = (f: Date) => (soloDia(f) - soloDia(anterior)) / curso
  const actos = eventos.map((e) => {
    const f = diaEnMadrid(e.startDate)
    return { fecha: f, titulo: e.title, tipo: e.type }
  })

  const domingo = pascua(fecha.getFullYear())
  const ceniza = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() - 46)
  if (!actos.some((a) => soloDia(a.fecha) === soloDia(ceniza) && /ceniza/i.test(a.titulo))) {
    actos.push({ fecha: ceniza, titulo: 'Miércoles de Ceniza', tipo: 'CULTO' })
  }

  return actos
    .map((a) => ({ ...a, p: posicion(a.fecha), pasado: soloDia(a.fecha) < soloDia(hoy) }))
    // Por si llega alguno del borde: el camino solo dibuja el curso.
    .filter((a) => a.p >= 0 && a.p <= 1)
    .sort((a, b) => a.p - b.p)
}

/**
 * Agrupa los actos en racimos: van juntos los que caen a `DIAS_DE_RACIMO` días
 * o menos del anterior. Luego se juntan los racimos que, a este `ancho` del
 * camino (en píxeles), quedarían a menos de `separacion` uno del otro: los
 * números no pueden pisarse, y en un móvil diez días son muy pocos píxeles.
 */
export function racimosDelCurso(actos: Acto[], hoy: Date, ancho: number, separacion = 36): Racimo[] {
  const { fecha, anterior } = cuentaAtrasEstacion(hoy)
  const diasDelCurso = (soloDia(fecha) - soloDia(anterior)) / DIA_EN_MS
  const grupos: Acto[][] = []
  for (const acto of actos) {
    const ultimo = grupos.at(-1)
    if (ultimo && (acto.p - ultimo[ultimo.length - 1].p) * diasDelCurso <= DIAS_DE_RACIMO) ultimo.push(acto)
    else grupos.push([acto])
  }

  const medio = (g: Acto[]) => (g[0].p + g[g.length - 1].p) / 2
  // Se junta siempre la pareja más apretada primero, hasta que ninguna se pise.
  for (;;) {
    let peor = -1
    let menor = Infinity
    for (let i = 1; i < grupos.length; i++) {
      const distancia = (medio(grupos[i]) - medio(grupos[i - 1])) * ancho
      if (distancia < separacion && distancia < menor) { menor = distancia; peor = i }
    }
    if (peor < 0) break
    grupos.splice(peor - 1, 2, [...grupos[peor - 1], ...grupos[peor]])
  }

  return grupos.map((g) => ({ actos: g, p: medio(g), porVenir: g.some((a) => !a.pasado) }))
}

/** El racimo que se abre solo: el próximo, o el último si el curso ya no tiene nada por delante. */
export function racimoInicial(racimos: Racimo[]): number {
  const proximo = racimos.findIndex((r) => r.porVenir)
  return proximo >= 0 ? proximo : racimos.length - 1
}

/** «16 oct – 18 oct», o solo «16 oct» si es un día. */
export function rangoDe(racimo: Racimo): string {
  const primero = racimo.actos[0].fecha
  const ultimo = racimo.actos[racimo.actos.length - 1].fecha
  return soloDia(primero) === soloDia(ultimo) ? diaMes(primero) : `${diaMes(primero)} – ${diaMes(ultimo)}`
}
