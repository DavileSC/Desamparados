import type { DatosFiscales } from '../certificado'
import { llamarApi } from './cliente'
import type { MetodoEnLinea, EstadoPedido } from './tienda'

export interface Pieza {
  id: number
  nombre: string
  precio: number
  /** Posición sobre la foto, en porcentaje del ancho y del alto. */
  x: number
  y: number
  apadrinada: boolean
  /** Solo si quien la apadrinó quiso que saliera (o en el CMS). */
  padrino: string | null
  dedicatoria: string | null
  contacto?: { email: string; telefono: string; pagadoEl: string | null; mostrarNombre: boolean }
}

export interface Campana {
  id: number
  titulo: string
  descripcion: string
  foto: string
  activa: boolean
  piezas: Pieza[]
}

export interface CampanasPublicas {
  pagoDisponible: boolean
  metodos: MetodoEnLinea[]
  campanas: (Campana & { libres: number })[]
}

export interface DatosApadrinar {
  piezaId: number
  nombre: string
  email: string
  telefono: string
  dedicatoria: string | null
  mostrarNombre: boolean
  metodo: MetodoEnLinea
  /** Si quiere el certificado para la renta. */
  fiscal?: DatosFiscales | null
}

export type ResultadoApadrinar =
  | { tipo: 'hecho'; token: string }
  | { tipo: 'banco'; token: string; pedido: string; url: string; campos: Record<string, string> }

export interface ApadrinamientoPublico { estado: EstadoPedido; nombre: string; pieza: string; campana: string; campanaId: number; importe: number }

export interface CampanaEnLista { id: number; titulo: string; foto: string; activa: boolean; piezas: number; apadrinadas: number; recaudado: number }
export interface DatosCampana { titulo: string; descripcion: string; foto: string; activa: boolean }
export interface DatosPieza { nombre: string; precio: number; x: number; y: number }

export const campanasPublicas = () => llamarApi<CampanasPublicas>('/apadrinamientos', { auth: false })
export const apadrinar = (d: DatosApadrinar) => llamarApi<ResultadoApadrinar>('/apadrinamientos', { method: 'POST', json: d, auth: false })
export const apadrinamientoPublico = (token: string) => llamarApi<ApadrinamientoPublico>(`/apadrinamientos/gracias/${token}`, { auth: false })

export const campanasDelCms = () => llamarApi<CampanaEnLista[]>('/apadrinamientos/admin/campanas')
export const campanaDelCms = (id: number) => llamarApi<Campana>(`/apadrinamientos/admin/campanas/${id}`)
export const crearCampana = (d: DatosCampana) => llamarApi<Campana>('/apadrinamientos/admin/campanas', { method: 'POST', json: d })
export const guardarCampana = (id: number, d: DatosCampana) => llamarApi<Campana>(`/apadrinamientos/admin/campanas/${id}`, { method: 'PUT', json: d })
export const ponerPieza = (id: number, d: DatosPieza) => llamarApi<Campana>(`/apadrinamientos/admin/campanas/${id}/piezas`, { method: 'POST', json: d })
export const cambiarPieza = (id: number, piezaId: number, d: DatosPieza) => llamarApi<Campana>(`/apadrinamientos/admin/campanas/${id}/piezas/${piezaId}`, { method: 'PUT', json: d })
export const quitarPieza = (id: number, piezaId: number) => llamarApi<Campana>(`/apadrinamientos/admin/campanas/${id}/piezas/${piezaId}`, { method: 'DELETE' })
