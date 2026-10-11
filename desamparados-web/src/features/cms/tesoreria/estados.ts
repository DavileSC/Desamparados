import type { AdminReceiptStatus } from '../../../lib/api/tesoreria'
import { segunModo } from '../../../theme/cms'

type Tono = { texto: string; fondo: string }

interface EstadoRecibo {
  /** «Pendiente»: el sello de cada recibo. */
  etiqueta: string
  /** «Pendientes»: el contador. */
  plural: string
  /** En qué total entra. Exentos y anulados no entran en ninguno. */
  cuenta: 'cobrar' | 'cobrado' | 'atencion' | 'nada'
  claro: Tono
  oscuro: Tono
}

/**
 * Un color, un icono y una palabra por estado. El color nunca va solo: el
 * icono y la palabra hacen que se lea igual en blanco y negro, impreso o con
 * daltonismo. Los textos pasan 4,5:1 sobre su fondo en los dos modos.
 */
export const ESTADOS_RECIBO: Record<AdminReceiptStatus, EstadoRecibo> = {
  PENDIENTE: {
    etiqueta: 'Pendiente', plural: 'Pendientes', cuenta: 'cobrar',
    claro: { texto: '#7a5000', fondo: 'rgba(237,161,0,0.16)' },
    oscuro: { texto: '#f2b84b', fondo: 'rgba(237,161,0,0.16)' },
  },
  REMESADO: {
    etiqueta: 'Remesado', plural: 'Remesados', cuenta: 'cobrar',
    claro: { texto: '#1b5aa6', fondo: 'rgba(42,120,214,0.12)' },
    oscuro: { texto: '#8ab8f0', fondo: 'rgba(57,135,229,0.18)' },
  },
  PAGADO: {
    etiqueta: 'Pagado', plural: 'Pagados', cuenta: 'cobrado',
    claro: { texto: '#23703f', fondo: 'rgba(76,175,110,0.16)' },
    oscuro: { texto: '#7fd19b', fondo: 'rgba(76,175,110,0.18)' },
  },
  DEVUELTO: {
    etiqueta: 'Devuelto', plural: 'Devueltos', cuenta: 'atencion',
    claro: { texto: '#a8231c', fondo: 'rgba(227,73,72,0.13)' },
    oscuro: { texto: '#ff8a80', fondo: 'rgba(227,73,72,0.20)' },
  },
  EXENTO: {
    etiqueta: 'Exento', plural: 'Exentos', cuenta: 'nada',
    claro: { texto: '#5f42a8', fondo: 'rgba(150,110,230,0.15)' },
    oscuro: { texto: '#c9b3f5', fondo: 'rgba(150,110,230,0.18)' },
  },
  // Lo que el Grupo devolvió a propósito (papeleta anulada, solicitud
  // cancelada): no es deuda, así que no va en rojo ni pide reemitirlo.
  REEMBOLSADO: {
    etiqueta: 'Reembolsado', plural: 'Reembolsados', cuenta: 'nada',
    claro: { texto: '#2c6470', fondo: 'rgba(60,140,155,0.13)' },
    oscuro: { texto: '#8fd0da', fondo: 'rgba(60,140,155,0.20)' },
  },
  ANULADO: {
    etiqueta: 'Anulado', plural: 'Anulados', cuenta: 'nada',
    claro: { texto: '#5c575b', fondo: 'rgba(0,0,0,0.06)' },
    oscuro: { texto: '#a39ea2', fondo: 'rgba(255,255,255,0.08)' },
  },
}

/**
 * Lo que se puede hacer a mano con un recibo en cada estado: el mismo grafo
 * que `domain/recibo-estados.ts` del servidor. Cobrar no está: tiene su botón
 * y su propia operación, porque apunta el ingreso.
 */
export const CAMBIOS_DE_ESTADO: Record<AdminReceiptStatus, readonly AdminReceiptStatus[]> = {
  PENDIENTE: ['REMESADO', 'EXENTO', 'ANULADO'],
  REMESADO: ['DEVUELTO', 'ANULADO'],
  PAGADO: ['DEVUELTO', 'REEMBOLSADO'],
  DEVUELTO: [],
  REEMBOLSADO: [],
  ANULADO: [],
  EXENTO: [],
}

/**
 * El texto del menú de cada cambio. Un cobrado tiene dos salidas que no se
 * deben confundir: el banco lo echó atrás (se sigue debiendo) o se le devuelve
 * el dinero al hermano (no se debe).
 */
export function accionDeCambio(destino: AdminReceiptStatus): string {
  if (destino === 'REMESADO') return 'Enviar al banco'
  if (destino === 'EXENTO') return 'Eximir de pago'
  if (destino === 'ANULADO') return 'Anular'
  if (destino === 'REEMBOLSADO') return 'Reembolsar al hermano'
  return 'Devuelto por el banco'
}

/** El tono de un estado en los dos modos a la vez: lo elige el navegador, sin volver a pintar. */
export function tonoDeEstado(estado: AdminReceiptStatus): Tono {
  const { claro, oscuro } = ESTADOS_RECIBO[estado]
  return { texto: segunModo(claro.texto, oscuro.texto), fondo: segunModo(claro.fondo, oscuro.fondo) }
}

/** En el orden de los contadores: primero lo que hay que hacer. */
export const ORDEN_ESTADOS: AdminReceiptStatus[] = ['PENDIENTE', 'REMESADO', 'DEVUELTO', 'PAGADO', 'REEMBOLSADO', 'EXENTO', 'ANULADO']
