import type { PaginaDeBloques } from '../../../lib/api/contenido'

/**
 * Lo que se dicen el constructor y la vista en vivo, que va en un iframe de la
 * misma web (`/cms/vista-previa/:slug`). En un iframe porque la web elige su
 * maquetación por el ancho de la VENTANA: solo dentro de una ventana de 390 px
 * se ve de verdad como en un móvil.
 *
 * - La vista avisa de que está lista (`lista`) y el constructor le manda el
 *   documento que se está escribiendo y el bloque abierto (`borrador`), cada
 *   vez que cambian.
 * - Al pulsar un bloque en la vista, esta lo dice (`pulsado`) y el
 *   constructor lo abre.
 *
 * Solo se aceptan mensajes del mismo origen y de la otra ventana concreta:
 * cualquier página puede hacer `postMessage`.
 */
export type Mensaje =
  | { tipo: 'desamparados:lista' }
  | { tipo: 'desamparados:borrador'; documento: PaginaDeBloques; seleccionado: number | null }
  | { tipo: 'desamparados:pulsado'; indice: number }

export const esMensaje = (dato: unknown): dato is Mensaje =>
  typeof dato === 'object' && dato !== null && typeof (dato as { tipo?: unknown }).tipo === 'string'
  && (dato as { tipo: string }).tipo.startsWith('desamparados:')

/** La dirección de la vista en vivo de una página. */
export const rutaDeLaVistaEnVivo = (slug: string) => `/cms/vista-previa/${slug}`
