import { llamarApi } from './cliente'
import type { Articulo } from '../../domain/articulos'

/** Un puesto que sugiere la mesa, con la ropa que suele llevar. */
export interface PuestoDelCatalogo {
  nombre: string
  tunica: boolean
  tocado: 'CAPIROTE' | 'FARAONA' | null
  alturaHombro: boolean
}

/** Una salida procesional, tal como la define el CMS. Ver docs/superpowers/specs/2026-10-01-salidas-configurables-design.md. */
export interface Salida {
  id: number
  slug: string
  nombre: string
  /** Con qué se escribe «del Sábado de Pasión» o «de la Procesión Magna» (domain/articulos.ts). */
  articulo: Articulo
  orden: number
  activa: boolean
  conRopa: boolean
  cobro: 'CUOTA' | 'DONATIVO'
  importeCuota: number
  fecha: 'PASCUA' | 'MANUAL'
  diasDesdePascua: number | null
  horaSalida: string | null
  lugar: string | null
  eventoId: number | null
  plazoAbierto: boolean
  puestos: PuestoDelCatalogo[]
  cortejo: { tramos: { nombre: string; plazas: number }[]; puestos: string[] } | null
  indicaciones: string | null
  anio: number
  fechaDelAnio: string | null
  /**
   * El acto de la Agenda de una salida a mano, con su instante (ISO) y su
   * lugar; `null` en una `PASCUA` o en una `MANUAL` sin fecha fijada todavía.
   * `fechaDelAnio` solo da el día: esto es lo que deja rellenar la fecha, la
   * hora y el lugar ya fijados al volver a abrir la ficha.
   */
  acto: { inicio: string; lugar: string | null } | null
}

export type DatosSalida = Omit<Salida, 'id' | 'eventoId' | 'plazoAbierto' | 'cortejo' | 'anio' | 'fechaDelAnio' | 'acto'>

export const CLAVE_SALIDAS = ['salidas'] as const

export const salidas = () => llamarApi<Salida[]>('/salidas')
export const salidasDelCms = () => llamarApi<Salida[]>('/cms/salidas')
export const crearSalida = (datos: DatosSalida) => llamarApi<Salida>('/cms/salidas', { method: 'POST', json: datos })
export const editarSalida = (id: number, datos: Partial<DatosSalida>) => llamarApi<Salida>(`/cms/salidas/${id}`, { method: 'PUT', json: datos })
export const fijarFechaDeSalida = (id: number, datos: { inicio: string; lugar?: string | null }) =>
  llamarApi<Salida>(`/cms/salidas/${id}/fecha`, { method: 'PUT', json: datos })
