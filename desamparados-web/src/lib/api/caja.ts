import { llamarApi } from './cliente'

export type MetodoDeCaja = 'EFECTIVO' | 'TARJETA' | 'BIZUM'

export interface VentaDeCaja {
  id: number
  total: number
  metodo: MetodoDeCaja
  vendidaEl: string
  vendedor: string | null
  anuladaEl: string | null
  anuladaPor: string | null
  /** `talla`, la de lo vendido si la tenía (copiada, como el nombre). */
  lineas: { productoId: number | null; nombre: string; talla: string | null; precio: number; cantidad: number }[]
}

export interface SesionDeCaja {
  id: number
  abiertaEl: string
  abiertaPor: string | null
  fondoInicial: number
  cerradaEl: string | null
  cerradaPor: string | null
  /** Lo que debía haber en efectivo: el fondo y lo cobrado en efectivo. */
  efectivoEsperado: number
  efectivoContado: number | null
  observaciones: string | null
  resumen: { ventas: number; anuladas: number; total: number; porMetodo: Record<MetodoDeCaja, number> }
  ventas: VentaDeCaja[]
}

export interface EstadoDeCaja { abierta: SesionDeCaja | null; cerradas: SesionDeCaja[] }

/** Una línea: un producto del catálogo, o algo suelto con su precio en céntimos. */
export type LineaDeVenta = { productoId: number; tallaId?: number; cantidad: number } | { nombre: string; centimos: number; cantidad: number }

export const estadoDeCaja = () => llamarApi<EstadoDeCaja>('/tienda/admin/caja')
export const abrirCaja = (fondoInicial: number) => llamarApi<EstadoDeCaja>('/tienda/admin/caja/abrir', { method: 'POST', json: { fondoInicial } })
export const venderEnCaja = (lineas: LineaDeVenta[], metodo: MetodoDeCaja) =>
  llamarApi<{ ventaId: number; total: number; estado: EstadoDeCaja }>('/tienda/admin/caja/ventas', { method: 'POST', json: { lineas, metodo } })
export const anularVenta = (id: number) => llamarApi<EstadoDeCaja>(`/tienda/admin/caja/ventas/${id}/anular`, { method: 'POST' })
export const cerrarCaja = (efectivoContado: number, observaciones: string | null) =>
  llamarApi<{ diferencia: number; estado: EstadoDeCaja }>('/tienda/admin/caja/cerrar', { method: 'POST', json: { efectivoContado, observaciones } })
