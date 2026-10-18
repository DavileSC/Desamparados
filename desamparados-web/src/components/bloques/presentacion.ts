import CATALOGO from '../../../../shared/presentacion-de-bloques.json'
import type { Bloque, Presentacion } from '../../lib/api/contenido'

/**
 * Las opciones de presentación de los bloques, leídas del catálogo que
 * comparten la web y el servidor (`shared/presentacion-de-bloques.json`).
 *
 * El primer valor de cada lista es el de siempre: un bloque que no dice nada
 * se pinta como antes de que existieran estas opciones.
 */
export type Opcion = { valores: string[] } | { siNo: boolean }

const COMUNES = CATALOGO.comunes as Record<string, Opcion>
const POR_TIPO = CATALOGO.porTipo as Record<string, Record<string, Opcion>>

/** Las opciones comunes a todos los bloques, en el orden del catálogo. */
export const OPCIONES_COMUNES = COMUNES

/** Las opciones propias de un tipo de bloque (sin las comunes). */
export const opcionesPropias = (tipo: string): Record<string, Opcion> => POR_TIPO[tipo] ?? {}

const opcionDe = (tipo: string, clave: string): Opcion | undefined => POR_TIPO[tipo]?.[clave] ?? COMUNES[clave]

/** Si una galería es solo de vídeos (y tiene alguno): entonces se reproducen ahí mismo. */
export const soloVideos = (medios: { tipo: string }[]): boolean =>
  medios.length > 0 && medios.every((m) => m.tipo === 'video')

/** Lo que hace falta mirar de un bloque para saber qué opciones tiene fijas. */
type ConPresentacion = { tipo: string; presentacion?: Presentacion; medios?: { tipo: string }[] }

/**
 * Las opciones que un bloque no deja elegir, con el valor que llevan.
 *
 * Una galería de solo vídeos va siempre en pase (el escenario con miniaturas)
 * y sin fondo: es la disposición donde el vídeo se reproduce ahí mismo, sin
 * abrir el visor, y el fondo de la franja competía con el del escenario. Una
 * que mezcla fotos y vídeos se elige como una de fotos, y sus vídeos se abren
 * en el visor. Lo guardado no se toca: si se añade una foto, vuelven las
 * opciones que se hubieran elegido.
 */
export function opcionesFijas(bloque: ConPresentacion): Record<string, string> {
  if (bloque.tipo === 'galeria' && soloVideos(bloque.medios ?? [])) {
    return { disposicion: 'pase', columnas: '3', fondo: 'ninguno' }
  }
  return {}
}

/** El valor de una opción de lista, o el de siempre si el bloque no lo dice. */
export function valorDe(bloque: ConPresentacion, clave: string): string {
  const fija = opcionesFijas(bloque)[clave]
  if (fija !== undefined) return fija
  const opcion = opcionDe(bloque.tipo, clave)
  const porDefecto = opcion && 'valores' in opcion ? opcion.valores[0] : ''
  const valor = bloque.presentacion?.[clave]
  return typeof valor === 'string' && opcion && 'valores' in opcion && opcion.valores.includes(valor) ? valor : porDefecto
}

/** Una opción de sí/no; no, si el bloque no lo dice. */
export const siDe = (bloque: { presentacion?: Presentacion }, clave: string): boolean => bloque.presentacion?.[clave] === true

/** Un campo libre de la presentación (la foto del fondo, el ancla, las fechas). */
export const libreDe = (bloque: { presentacion?: Presentacion }, clave: 'fondoFoto' | 'ancla' | 'desde' | 'hasta'): string => {
  const valor = bloque.presentacion?.[clave]
  return typeof valor === 'string' ? valor : ''
}

/**
 * El ancho máximo del contenido de un bloque: el suyo de siempre (`normal`),
 * uno de lectura cómoda (`estrecho`) o todo el de la página (`ancho`).
 *
 * Estrecho nunca ensancha: una foto pequeña (480 px) o una carta (680 px) ya
 * son más estrechas que 720 y se quedan como están.
 */
export function anchoMaximo(bloque: Bloque, propio: string | number): string | number {
  const ancho = valorDe(bloque, 'ancho')
  if (ancho === 'estrecho') {
    if (typeof propio === 'number') return Math.min(propio, 720)
    return propio === 'none' ? '720px' : `min(${propio}, 720px)`
  }
  if (ancho === 'ancho') return 'none'
  return propio
}

/** Hoy en Madrid, como AAAA-MM-DD: es el día en que piensa quien programa un bloque. */
export function hoyEnMadrid(ahora = new Date()): string {
  // El formato sueco es justo AAAA-MM-DD.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

type Visibilidad = 'visible' | 'oculto' | 'antes' | 'despues'

/**
 * Si el bloque se ve hoy, y si no, por qué: oculto a mano, programado para más
 * adelante o ya caducado. Las fechas incluyen su día entero.
 */
export function visibilidadDe(bloque: { presentacion?: Presentacion }, hoy = hoyEnMadrid()): Visibilidad {
  if (siDe(bloque, 'oculto')) return 'oculto'
  const desde = libreDe(bloque, 'desde')
  const hasta = libreDe(bloque, 'hasta')
  if (desde && hoy < desde) return 'antes'
  if (hasta && hoy > hasta) return 'despues'
  return 'visible'
}

/** La fecha AAAA-MM-DD como «3 de noviembre». */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  if (!anio || !mes || !dia) return fecha
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(anio, mes - 1, dia)))
}
