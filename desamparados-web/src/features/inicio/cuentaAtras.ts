import type { Articulo } from '../../domain/articulos'
import type { ProximaSalidaWeb } from '../../lib/api/salidas'
import { instanteEnMadrid } from '../../components/bloques/fechas'

/**
 * La cuenta atrás de la portada, a partir de la próxima salida que da el
 * servidor (su día y su hora de Madrid). Puro, para probarlo con un «ahora»
 * fijo.
 *
 * - Con hora, se cuentan días, horas, minutos y segundos hasta ese instante
 *   de Madrid; sin ella, solo los días.
 * - El día de la salida, hasta medianoche, es «hoy»; al día siguiente el
 *   servidor ya da la siguiente.
 */
interface CuentaDeLaPortada {
  nombre: string
  articulo: Articulo
  /** El día, `AAAA-MM-DD`, en Madrid. */
  dia: string
  /** El instante al que se cuenta (ms). Sin hora, el comienzo del día. */
  instante: number
  conHora: boolean
  hoy: boolean
}

/** El día de Madrid de un instante: un acto a las 00:30 del 17 es del 17. */
const diaEnMadrid = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(ms))

export function cuentaDeLaPortada(p: ProximaSalidaWeb | null, ahora: number): CuentaDeLaPortada | null {
  if (!p) return null
  const hoy = diaEnMadrid(ahora)
  // Una página abierta desde ayer puede traer una salida que ya pasó: hasta que se vuelva a pedir, nada.
  if (p.dia < hoy) return null
  const instante = instanteEnMadrid(`${p.dia}T${p.hora ?? '00:00'}`)
  if (instante === null) return null
  return { nombre: p.nombre, articulo: p.articulo, dia: p.dia, instante, conHora: p.hora !== null, hoy: p.dia === hoy }
}

/** Días, horas, minutos y segundos que faltan. Sin hora, los días son de calendario (de hoy a ese día). */
export function partesQueFaltan(p: CuentaDeLaPortada, ahora: number) {
  if (!p.conHora) {
    const dias = Math.round((Date.parse(p.dia) - Date.parse(diaEnMadrid(ahora))) / 86_400_000)
    return { dias, horas: 0, minutos: 0, segundos: 0 }
  }
  const s = Math.max(0, Math.floor((p.instante - ahora) / 1000))
  return { dias: Math.floor(s / 86_400), horas: Math.floor((s % 86_400) / 3600), minutos: Math.floor((s % 3600) / 60), segundos: s % 60 }
}
