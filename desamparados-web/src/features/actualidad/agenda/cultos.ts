import type { ApiEvent } from '../../../lib/api/agenda'
import { TIPOS, inicioDeMes, inicioDelDia } from '../../inicio/agenda'

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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** Los días que abarca un acto, en la hora de este navegador. */
export function diasDelActo(evento: ApiEvent): Date[] {
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

/** En el cartel: «Sábado 24 de octubre» o «Días 3, 4 y 5 de noviembre». */
export function cuandoEnCartel(evento: ApiEvent) {
  const lista = diasDelActo(evento)
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

/** Qué es el acto, en la ventana: «Culto solemne» si va en cartel; si no, su tipo. */
export const claseDelActo = (evento: ApiEvent) => (evento.cartel ? claseDelCartel(evento) : TIPOS[evento.type].nombre)

/** El lugar y la descripción, como una frase: con su punto final, sin doblarlo. */
export function notaDelActo(evento: ApiEvent) {
  return [evento.location?.trim(), evento.description?.trim()].filter(Boolean)
    .map((t) => (/[.!?…]$/.test(t!) ? t : `${t}.`)).join(' ')
}

/** Un día como clave: «2026-11-03», en la hora de este navegador. */
export const claveDelDia = (dia: Date) =>
  `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`

/** Si el acto cae ese día: un triduo del 3 al 5 cae el 3, el 4 y el 5. */
export function caeEnElDia(evento: ApiEvent, dia: Date) {
  const clave = claveDelDia(dia)
  return diasDelActo(evento).some((d) => claveDelDia(d) === clave)
}

/**
 * El primer día del acto que se ve en ese mes: el suyo o, si viene del mes
 * anterior (un triduo del 30 al 2), el día 1. Ahí va su título y ahí se ancla su ventana.
 */
export function primerDiaEnElMes(evento: ApiEvent, mes: Date) {
  return diasDelActo(evento).find((d) => d.getFullYear() === mes.getFullYear() && d.getMonth() === mes.getMonth()) ?? null
}

/** El último mes al que se puede llegar: el del último día del último acto, y nunca antes que el de hoy. */
export function ultimoMes(eventos: ApiEvent[], hoy: Date) {
  let ultimo = inicioDeMes(hoy)
  for (const evento of eventos) {
    const dias = diasDelActo(evento)
    const mes = inicioDeMes(dias[dias.length - 1])
    if (mes > ultimo) ultimo = mes
  }
  return ultimo
}
