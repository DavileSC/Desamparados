/**
 * Qué tiene y qué le falta a una noticia o a una publicación para quedar bien
 * en la web.
 *
 * Noticia: las cuatro piezas que se ven en la tarjeta de la portada y en la
 * ficha pública. Sin extracto, la tarjeta se queda en el título; sin foto, cae
 * a una placa con la inicial; sin texto, la ficha está vacía.
 *
 * Publicación: el PDF es lo que se descarga; la descripción y la portada, lo
 * que se ve de ella en la portada y en el listado. Sin portada, la tarjeta del
 * listado se queda sin imagen.
 *
 * Lo comparten los listados (la barra de los borradores) y las fichas de
 * edición, para que digan lo mismo.
 */

import { PDF_DE_RELLENO } from '../portadaPublicacion'

export type ClavePieza = 'titulo' | 'extracto' | 'texto' | 'foto' | 'descripcion' | 'pdf' | 'portada'

export interface Pieza {
  clave: ClavePieza
  /** Con artículo, para montar la frase: «le falta la foto». */
  nombre: string
  lista: boolean
}

interface NoticiaParaRevisar {
  titulo: string
  extracto?: string | null
  contenido: string
  imagenUrl?: string | null
}

/** El HTML del editor vacío es `<p></p>`: cuenta como sin texto. Una foto incrustada sí cuenta. */
export function tieneTexto(html: string): boolean {
  if (/<img\b/i.test(html)) return true
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '') !== ''
}

export function piezasDeNoticia(noticia: NoticiaParaRevisar): Pieza[] {
  return [
    { clave: 'titulo', nombre: 'el título', lista: noticia.titulo.trim() !== '' },
    { clave: 'extracto', nombre: 'el extracto', lista: Boolean(noticia.extracto?.trim()) },
    { clave: 'texto', nombre: 'el texto', lista: tieneTexto(noticia.contenido) },
    { clave: 'foto', nombre: 'la foto', lista: Boolean(noticia.imagenUrl) },
  ]
}

interface PublicacionParaRevisar {
  titulo: string
  descripcion?: string | null
  archivoUrl: string
  imagenUrl?: string | null
}

/** El PDF de relleno del seed no cuenta: es un aviso de «aquí va el de verdad». */
export function piezasDePublicacion(publicacion: PublicacionParaRevisar): Pieza[] {
  return [
    { clave: 'titulo', nombre: 'el título', lista: publicacion.titulo.trim() !== '' },
    { clave: 'descripcion', nombre: 'la descripción', lista: Boolean(publicacion.descripcion?.trim()) },
    { clave: 'pdf', nombre: 'el PDF', lista: Boolean(publicacion.archivoUrl) && publicacion.archivoUrl !== PDF_DE_RELLENO },
    { clave: 'portada', nombre: 'la portada', lista: Boolean(publicacion.imagenUrl) },
  ]
}

/** «Lista para publicar», «Le falta la foto», «Le faltan el extracto y la foto». */
export function queLeFalta(piezas: Pieza[]): string {
  const faltan = piezas.filter((p) => !p.lista).map((p) => p.nombre)
  if (faltan.length === 0) return 'Lista para publicar'
  if (faltan.length === 1) return `Le falta ${faltan[0]}`
  return `Le faltan ${faltan.slice(0, -1).join(', ')} y ${faltan.at(-1)}`
}

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** «hace un momento», «hace 3 horas», «ayer», «hace 2 semanas»; más allá de un mes, la fecha. */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const segundos = (new Date(iso).getTime() - ahora.getTime()) / 1000
  const minutos = segundos / 60
  const horas = minutos / 60
  const dias = horas / 24
  if (Math.abs(minutos) < 1) return 'hace un momento'
  if (Math.abs(horas) < 1) return relativo.format(Math.round(minutos), 'minute')
  if (Math.abs(dias) < 1) return relativo.format(Math.round(horas), 'hour')
  if (Math.abs(dias) < 7) return relativo.format(Math.round(dias), 'day')
  if (Math.abs(dias) < 31) return relativo.format(Math.round(dias / 7), 'week')
  return `el ${fechaCorta(iso)}`
}

// Tres letras siempre («sep», no «sept.»): la abreviatura de cada motor varía.
// La misma forma que la tarjeta pública (TarjetaNoticia).
export function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  return `${fecha.getDate()} ${fecha.toLocaleDateString('es-ES', { month: 'long' }).slice(0, 3)} ${fecha.getFullYear()}`
}
