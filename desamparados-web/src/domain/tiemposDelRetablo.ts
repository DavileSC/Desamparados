/**
 * Cuándo cae cada tiempo del retablo y cuál manda un día: la gemela de
 * `backend-desamparados/src/domain/retablo.ts`. Aquí solo sirve para pintar,
 * mientras se edita, la barra del año y qué foto está «en uso hoy»; la foto
 * que ve la junta en el Inicio la decide el servidor.
 *
 * Fechas en `AAAA-MM-DD`, como en el servidor: se comparan como texto.
 */
import type { TiempoDelRetablo } from '../lib/api/panel'
import { pascua } from './sabadoDePasion'

const aTexto = (f: Date) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
const sumarDias = (f: Date, n: number) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n)

interface Tramo {
  desde: string
  hasta: string
}

/** Las fechas de un tiempo que empieza en el año `anio`, los dos extremos incluidos. */
export function tramoDelTiempo(t: TiempoDelRetablo, anio: number): Tramo {
  switch (t.tiempo) {
    case 'cuaresma': {
      const domingo = pascua(anio)
      return { desde: aTexto(sumarDias(domingo, -46)), hasta: aTexto(domingo) }
    }
    case 'semana-santa': {
      const domingo = pascua(anio)
      return { desde: aTexto(sumarDias(domingo, -7)), hasta: aTexto(domingo) }
    }
    case 'navidad':
      return { desde: `${anio}-12-24`, hasta: `${anio + 1}-01-06` }
    case 'a-mano':
      return { desde: `${anio}-${t.desde}`, hasta: `${t.hasta < t.desde ? anio + 1 : anio}-${t.hasta}` }
  }
}

const DIA_EN_MS = 24 * 60 * 60 * 1000
const duracion = (r: Tramo) => (Date.parse(r.hasta) - Date.parse(r.desde)) / DIA_EN_MS

/** El índice del tiempo que manda ese día, o -1 (la foto de todo el año). Si caen varios, el más corto. */
export function tiempoDelDia(tiempos: readonly TiempoDelRetablo[], dia: string): number {
  const anio = Number(dia.slice(0, 4))
  let elegido = -1
  let menor = Infinity
  tiempos.forEach((t, i) => {
    const tramo = [tramoDelTiempo(t, anio - 1), tramoDelTiempo(t, anio)].find((r) => r.desde <= dia && dia <= r.hasta)
    if (tramo && duracion(tramo) < menor) { elegido = i; menor = duracion(tramo) }
  })
  return elegido
}

/** Qué foto toca cada día del año `anio`: el índice del tiempo, o -1. Para la barra del año. */
export function fotosDelAnio(tiempos: readonly TiempoDelRetablo[], anio: number): number[] {
  const dias: number[] = []
  for (let f = new Date(anio, 0, 1); f.getFullYear() === anio; f = sumarDias(f, 1)) dias.push(tiempoDelDia(tiempos, aTexto(f)))
  return dias
}

export const hoyEnTexto = (hoy = new Date()) => aTexto(hoy)

/**
 * Cuándo cae, en palabras: las fechas a mano, como se repiten («Cada año, del
 * 1 al 31 de mayo»); las calculadas, las de la próxima vez que toquen (si la
 * de este año ya pasó, la del que viene): «En 2027, del 10 de febrero al 28
 * de marzo».
 */
export function tramoEnPalabras(t: TiempoDelRetablo, hoy = new Date()): string {
  const fecha = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))))
  const anio = hoy.getFullYear()
  const deEste = tramoDelTiempo(t, anio)
  const { desde, hasta } = deEste.hasta < aTexto(hoy) ? tramoDelTiempo(t, anio + 1) : deEste
  return t.tiempo === 'a-mano' ? `Cada año, del ${fecha(desde)} al ${fecha(hasta)}` : `En ${desde.slice(0, 4)}, del ${fecha(desde)} al ${fecha(hasta)}`
}
