import type { PanelResponse, TipoEvento } from '../../../lib/api/panel'
import { pascua } from '../../../domain/sabadoDePasion'

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

/** La hora en España, «19:00»; a medianoche no se dice (es un acto de todo el día). */
function horaEnMadrid(iso: string): string | null {
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  return hora === '00:00' ? null : hora
}

export interface Acto {
  fecha: Date
  titulo: string
  tipo: TipoEvento
  /** «19:00» en España, o nada si es de todo el día. */
  hora: string | null
  lugar: string | null
  /** Posición en el año, de 0 (el 1 de enero) a 1 (el 31 de diciembre por la noche). */
  p: number
  /** Ya ha pasado (hoy todavía no cuenta como pasado). */
  pasado: boolean
}

/** Qué parte del año ha pasado, de 0 a 100: el Grupo lleva su año del 1 de enero al 31 de diciembre. */
export function parteDelAnio(hoy: Date): number {
  const inicio = Date.UTC(hoy.getFullYear(), 0, 1)
  const fin = Date.UTC(hoy.getFullYear() + 1, 0, 1)
  return Math.min(100, Math.max(0, Math.round(((soloDia(hoy) - inicio) / (fin - inicio)) * 100)))
}

/**
 * Todos los actos del año, en orden, con el Miércoles de Ceniza aunque no
 * esté en la Agenda: sin él, la Cuaresma no se ve empezar y su tanda no sabe llamarse así.
 */
export function actosDelAnio(hoy: Date, eventos: PanelResponse['anio']['eventos']): Acto[] {
  const inicio = Date.UTC(hoy.getFullYear(), 0, 1)
  const largo = Date.UTC(hoy.getFullYear() + 1, 0, 1) - inicio
  const posicion = (f: Date) => (soloDia(f) - inicio) / largo
  const actos = eventos.map((e) => {
    const f = diaEnMadrid(e.startDate)
    return { fecha: f, titulo: e.title, tipo: e.type, hora: horaEnMadrid(e.startDate), lugar: e.location ?? null }
  })

  const domingo = pascua(hoy.getFullYear())
  const ceniza = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() - 46)
  if (!actos.some((a) => soloDia(a.fecha) === soloDia(ceniza) && /ceniza/i.test(a.titulo))) {
    actos.push({ fecha: ceniza, titulo: 'Miércoles de Ceniza', tipo: 'CULTO', hora: null, lugar: null })
  }

  return actos
    .map((a) => ({ ...a, p: posicion(a.fecha), pasado: soloDia(a.fecha) < soloDia(hoy) }))
    // Por si llega alguno del borde: solo cuenta el año.
    .filter((a) => a.p >= 0 && a.p < 1)
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
 * Días sin actos a partir de los cuales empieza otra tanda. El Grupo vive a
 * golpes —la Cuaresma, el Triduo de mayo, la vuelta en septiembre— y entre
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
 * días sin actos. De la Ceniza al Domingo de Resurrección, todo es una sola
 * tanda: la Cuaresma, con el Sábado de Pasión dentro. Lo que viene después ya
 * es el resto del año.
 */
export function tandasDelAnio(actos: Acto[], hoy: Date): Tanda[] {
  const ceniza = actos.find((a) => /ceniza/i.test(a.titulo))
  const resurreccion = ceniza ? pascua(ceniza.fecha.getFullYear()) : null
  const enCuaresma = (a: Acto) => ceniza !== undefined && resurreccion !== null
    && soloDia(a.fecha) >= soloDia(ceniza.fecha) && soloDia(a.fecha) <= soloDia(resurreccion)
  const grupos: Acto[][] = []
  for (const acto of actos) {
    const ultimo = grupos.at(-1)
    const previo = ultimo?.[ultimo.length - 1]
    if (ultimo && previo && (diasEntre(previo.fecha, acto.fecha) < DIAS_DE_CALMA || (enCuaresma(previo) && enCuaresma(acto)))) ultimo.push(acto)
    else grupos.push([acto])
  }
  const tandas = grupos.map((g) => {
    const inicio = g[0].fecha
    const fin = g[g.length - 1].fecha
    const estado = soloDia(fin) < soloDia(hoy) ? 'pasada' : soloDia(inicio) <= soloDia(hoy) ? 'viva' : 'porVenir'
    const hecho = estado === 'viva' ? diasEntre(inicio, hoy) / Math.max(1, diasEntre(inicio, fin)) : estado === 'pasada' ? 1 : 0
    return { actos: g, inicio, fin, nombre: nombreDe(g), estado, hecho } satisfies Tanda
  })
  // Dos tandas en el mismo mes se llamarían igual («Noviembre» y «Noviembre»):
  // esas se nombran por sus días, en corto para que quepan: «3–8 nov».
  const repetidos = new Set(tandas.map((t) => t.nombre).filter((n, i, todos) => todos.indexOf(n) !== i))
  return tandas.map((t) => (repetidos.has(t.nombre) ? { ...t, nombre: diasDe(t) } : t))
}

function diasDe({ inicio, fin }: Pick<Tanda, 'inicio' | 'fin'>): string {
  if (soloDia(inicio) === soloDia(fin)) return diaMes(inicio)
  if (inicio.getMonth() === fin.getMonth()) return `${inicio.getDate()}–${diaMes(fin)}`
  return `${diaMes(inicio)} – ${diaMes(fin)}`
}

export type Momento =
  | { tipo: 'plena'; tanda: Tanda; quedan: number; siguiente: Acto }
  | { tipo: 'calma'; tanda: Tanda }
  | { tipo: 'fin' }

/** En qué punto del año estamos: dentro de una tanda, esperando la próxima o sin nada por delante. */
export function momentoDelAnio(tandas: Tanda[]): Momento {
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
