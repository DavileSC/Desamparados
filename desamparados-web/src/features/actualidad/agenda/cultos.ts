import type { ApiEvent } from '../../../lib/api/agenda'
import { TIPOS, inicioDelDia } from '../../inicio/agenda'

/** Los filtros de la Agenda pública, de texto: lo que busca quien entra, no los siete tipos. */
export const FILTROS = [
  { valor: 'todo', nombre: 'Todo' },
  { valor: 'cultos', nombre: 'Cultos y salidas' },
  { valor: 'formacion', nombre: 'Formación' },
  { valor: 'vida', nombre: 'Vida de hermandad' },
] as const
export type Filtro = (typeof FILTROS)[number]['valor']

const GRUPO: Record<ApiEvent['type'], Exclude<Filtro, 'todo'>> = {
  CULTO: 'cultos', PROCESION: 'cultos', FORMACION: 'formacion',
  ENSAYO: 'vida', REUNION: 'vida', SOCIAL: 'vida', OTRO: 'vida',
}
export const pasaElFiltro = (evento: ApiEvent, filtro: Filtro) => filtro === 'todo' || GRUPO[evento.type] === filtro

/** Un tramo de la página: un cartel o la lista de los actos que van hasta el siguiente. */
export type Tramo = { cartel: ApiEvent } | { actos: ApiEvent[] }

/** Los actos, en orden, partidos por los carteles: lista, cartel, lista, cartel… */
export function enTramos(eventos: ApiEvent[]): Tramo[] {
  const tramos: Tramo[] = []
  let tanda: ApiEvent[] = []
  for (const evento of eventos) {
    if (!evento.cartel) { tanda.push(evento); continue }
    if (tanda.length) tramos.push({ actos: tanda })
    tanda = []
    tramos.push({ cartel: evento })
  }
  if (tanda.length) tramos.push({ actos: tanda })
  return tramos
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** Los días que abarca un acto, en la hora de este navegador. */
function dias(evento: ApiEvent): Date[] {
  const inicio = inicioDelDia(new Date(evento.startDate))
  const fin = evento.endDate ? inicioDelDia(new Date(evento.endDate)) : inicio
  const lista: Date[] = []
  for (let d = inicio; d <= fin && lista.length < 31; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) lista.push(d)
  return lista
}

/**
 * Los días de un acto de varios, como se dicen: «3, 4 y 5 de noviembre»; si
 * cambia de mes o son muchos, «del 30 de octubre al 2 de noviembre».
 */
function variosDias(lista: Date[]) {
  const [primero, ultimo] = [lista[0], lista[lista.length - 1]]
  if (primero.getMonth() !== ultimo.getMonth() || lista.length > 5) {
    return `del ${primero.getDate()} de ${MESES[primero.getMonth()]} al ${ultimo.getDate()} de ${MESES[ultimo.getMonth()]}`
  }
  const numeros = lista.map((d) => d.getDate())
  return `${numeros.slice(0, -1).join(', ')} y ${numeros[numeros.length - 1]} de ${MESES[primero.getMonth()]}`
}

/** En la lista: «3 de octubre, sábado» o «13 y 14 de octubre». */
export function cuandoEnLista(evento: ApiEvent) {
  const lista = dias(evento)
  if (lista.length > 1) return mayuscula(variosDias(lista))
  const d = lista[0]
  return `${d.getDate()} de ${MESES[d.getMonth()]}, ${DIAS[d.getDay()]}`
}

/** En el cartel: «Sábado 24 de octubre» o «Días 3, 4 y 5 de noviembre». */
export function cuandoEnCartel(evento: ApiEvent) {
  const lista = dias(evento)
  if (lista.length > 1) {
    const texto = variosDias(lista)
    return texto.startsWith('del ') ? mayuscula(texto) : `Días ${texto}`
  }
  const d = lista[0]
  return `${mayuscula(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** «19:00», en la hora de este navegador. */
export const hora = (evento: ApiEvent) =>
  new Date(evento.startDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

/** Lo que dice el cartel sobre el título: qué clase de acto es. */
export function claseDelCartel(evento: ApiEvent) {
  if (evento.type === 'CULTO') return 'Culto solemne'
  if (evento.type === 'PROCESION') return 'Salida procesional'
  return TIPOS[evento.type].nombre
}

/**
 * La foto del cartel. Sin una propia, la de la Titular en los cultos y la de
 * la procesión en las salidas: las dos que ya tiene la web.
 */
export function fotoDelCartel(evento: ApiEvent): { src: string; alt: string } {
  if (evento.fotoCartel) return { src: evento.fotoCartel, alt: `Cartel: ${evento.title}` }
  return evento.type === 'PROCESION'
    ? { src: '/images/procesion.jpg', alt: 'Nuestra Señora de los Desamparados por las calles, con sus nazarenos' }
    : { src: '/images/triduo.jpg', alt: 'Nuestra Señora de los Desamparados' }
}

/** «Cómo llegar»: el lugar en el mapa. Con «Málaga» detrás, para que no busque en todo el mundo. */
export function urlDelMapa(lugar: string | null | undefined): string | null {
  const limpio = lugar?.trim()
  if (!limpio) return null
  const consulta = /málaga/i.test(limpio) ? limpio : `${limpio}, Málaga`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`
}
