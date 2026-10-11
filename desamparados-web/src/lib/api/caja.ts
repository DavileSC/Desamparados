import { llamarApi } from './cliente'

export type MetodoDeCaja = 'EFECTIVO' | 'TARJETA' | 'BIZUM'

/** Una venta en mano: lo que se lleva alguien en Secretaría sin pasar por la web. */
export interface VentaEnMano {
  id: number
  total: number
  metodo: MetodoDeCaja
  vendidaEl: string
  vendedor: string | null
  anuladaEl: string | null
  anuladaPor: string | null
  /** Las de una caja de las de antes, ya cerrada, no se anulan. */
  anulable: boolean
  /** `talla`, la de lo vendido si la tenía (copiada, como el nombre). */
  lineas: { productoId: number | null; nombre: string; talla: string | null; precio: number; cantidad: number }[]
}

/** El efectivo de la tienda llevado al banco. */
export interface IngresoEnBanco {
  id: number
  /** AAAA-MM-DD. */
  fecha: string
  importe: number
  nota: string | null
  apuntadoPor: string | null
}

export interface EstadoVentaEnMano {
  /** Lo cobrado en efectivo menos lo ya ingresado en el banco. */
  efectivoPorIngresar: number
  /** Las últimas, de la más reciente a la más antigua. */
  ventas: VentaEnMano[]
  ingresos: IngresoEnBanco[]
}

/** Una línea: un producto del catálogo (con su talla, si la tiene), o algo suelto con su precio en céntimos. */
type LineaDeVenta = { productoId: number; tallaId?: number; cantidad: number } | { nombre: string; centimos: number; cantidad: number }

export const estadoVentaEnMano = () => llamarApi<EstadoVentaEnMano>('/tienda/admin/caja')
export const venderEnMano = (lineas: LineaDeVenta[], metodo: MetodoDeCaja) =>
  llamarApi<{ ventaId: number; total: number; estado: EstadoVentaEnMano }>('/tienda/admin/caja/ventas', { method: 'POST', json: { lineas, metodo } })
export const anularVenta = (id: number) => llamarApi<EstadoVentaEnMano>(`/tienda/admin/caja/ventas/${id}/anular`, { method: 'POST' })
export const ingresarEnBanco = (fecha: string, importe: number, nota: string | null) =>
  llamarApi<EstadoVentaEnMano>('/tienda/admin/caja/ingresos', { method: 'POST', json: { fecha, importe, nota } })
export const borrarIngreso = (id: number) => llamarApi<EstadoVentaEnMano>(`/tienda/admin/caja/ingresos/${id}`, { method: 'DELETE' })
