import type { PanelResponse, TipoEvento } from '../../../lib/api/panel'
import { cuentaAtrasEstacion, pascua } from '../../../domain/sabadoDePasion'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
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

/**
 * Todos los actos del curso, en orden, con el Miércoles de Ceniza aunque no
 * esté en la Agenda: sin él, la Cuaresma no se ve empezar y su tanda no sabe llamarse así.
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
    // Por si llega alguno del borde: solo cuenta el curso.
    .filter((a) => a.p >= 0 && a.p <= 1)
    .sort((a, b) => a.p - b.p)
}

export interface Tanda {
  actos: Acto[]
  inicio: Date
  fin: Date
  /** «Cuaresma», «Mayo» o «Sep – oct». */
  nombre: string
  estado: 'pasada' | 'viva' | 'porVenir'
  /** Parte de la tanda ya andada, de 0 a 1 (solo cuenta en la viva). */
  hecho: number
}

/**
 * Días sin actos a partir de los cuales empieza otra tanda. La Hermandad vive
 * a golpes —el Triduo de mayo, la vuelta en septiembre, la Cuaresma— y entre
 * medias puede pasar meses sin nada: dos semanas de calma ya separan.
 */
export const DIAS_DE_CALMA = 14

/** Días enteros de `a` a `b`. */
export const diasEntre = (a: Date, b: Date) => Math.round((soloDia(b) - soloDia(a)) / DIA_EN_MS)

function nombreDe(actos: Acto[]): string {
  if (actos.some((a) => /ceniza/i.test(a.titulo))) return 'Cuaresma'
  const m1 = actos[0].fecha.getMonth()
  const m2 = actos[actos.length - 1].fecha.getMonth()
  if (m1 === m2) return MESES_LARGOS[m1]
  return `${MESES_LARGOS[m1].slice(0, 3)} – ${MESES[m2]}`
}

/**
 * Parte los actos (ya en orden) en tandas: empieza otra tras `DIAS_DE_CALMA`
 * días sin actos. Desde la Ceniza, todo es una sola tanda: la Cuaresma.
 */
export function tandasDelCurso(actos: Acto[], hoy: Date): Tanda[] {
  const ceniza = actos.find((a) => /ceniza/i.test(a.titulo))
  const enCuaresma = (a: Acto) => ceniza !== undefined && soloDia(a.fecha) >= soloDia(ceniza.fecha)
  const grupos: Acto[][] = []
  for (const acto of actos) {
    const ultimo = grupos.at(-1)
    const previo = ultimo?.[ultimo.length - 1]
    if (ultimo && previo && (diasEntre(previo.fecha, acto.fecha) < DIAS_DE_CALMA || (enCuaresma(previo) && enCuaresma(acto)))) ultimo.push(acto)
    else grupos.push([acto])
  }
  return grupos.map((g) => {
    const inicio = g[0].fecha
    const fin = g[g.length - 1].fecha
    const estado = soloDia(fin) < soloDia(hoy) ? 'pasada' : soloDia(inicio) <= soloDia(hoy) ? 'viva' : 'porVenir'
    const hecho = estado === 'viva' ? diasEntre(inicio, hoy) / Math.max(1, diasEntre(inicio, fin)) : estado === 'pasada' ? 1 : 0
    return { actos: g, inicio, fin, nombre: nombreDe(g), estado, hecho }
  })
}

export type Momento =
  | { tipo: 'plena'; tanda: Tanda; quedan: number; siguiente: Acto }
  | { tipo: 'calma'; tanda: Tanda }
  | { tipo: 'fin' }

/** En qué punto del curso estamos: dentro de una tanda, esperando la próxima o sin nada por delante. */
export function momentoDelCurso(tandas: Tanda[]): Momento {
  const viva = tandas.find((t) => t.estado === 'viva')
  if (viva) {
    const quedan = viva.actos.filter((a) => !a.pasado)
    return { tipo: 'plena', tanda: viva, quedan: quedan.length, siguiente: quedan[0] }
  }
  const proxima = tandas.find((t) => t.estado === 'porVenir')
  return proxima ? { tipo: 'calma', tanda: proxima } : { tipo: 'fin' }
}

/** La tanda que se abre sola: la que estamos viviendo, la próxima, o la última si ya no queda nada. */
export function tandaInicial(tandas: Tanda[]): number {
  const i = tandas.findIndex((t) => t.estado !== 'pasada')
  return i >= 0 ? i : tandas.length - 1
}

/** «16 oct – 18 oct», o solo «16 oct» si es un día. */
export function rangoDe(tanda: Pick<Tanda, 'inicio' | 'fin'>): string {
  return soloDia(tanda.inicio) === soloDia(tanda.fin) ? diaMes(tanda.inicio) : `${diaMes(tanda.inicio)} – ${diaMes(tanda.fin)}`
}

/** «hoy», «mañana», «en 5 días», «en 3 semanas», «en 4 meses». */
export function cuandoFalta(hoy: Date, fecha: Date): string {
  const n = diasEntre(hoy, fecha)
  if (n <= 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n < 14) return `en ${n} días`
  if (n < 60) return `en ${Math.round(n / 7)} semanas`
  return `en ${Math.round(n / 30)} meses`
}

/** Lo que dura una calma, en corto: «3 sem.», «2 meses». */
export function calmaCorta(dias: number): string {
  return dias < 60 ? `${Math.round(dias / 7)} sem.` : `${Math.round(dias / 30)} meses`
}
