import { llamarApi } from './cliente'

export interface Producto {
  id: number
  nombre: string
  descripcion: string
  precio: number
  foto: string | null
  /** Las de más, que se ven en la galería al pulsar la foto. */
  fotos: FotoDeProducto[]
  /** Null: sin límite. */
  existencias: number | null
  activo: boolean
  orden: number
}

export interface FotoDeProducto { url: string; pie: string }

/** Las fotos de más que admite un producto, además de la principal (el tope del servidor). */
export const MAX_FOTOS_PRODUCTO = 8

export type MetodoEnLinea = 'TARJETA' | 'BIZUM'
export type EstadoPedido = 'PENDIENTE_PAGO' | 'PAGADO' | 'ENTREGADO' | 'CANCELADO'

export interface Catalogo { productos: Producto[]; pagoDisponible: boolean; metodos: MetodoEnLinea[] }

export interface DatosCompra {
  nombre: string
  email: string
  telefono: string
  metodo: MetodoEnLinea
  lineas: { productoId: number; cantidad: number }[]
}

export type ResultadoCompra =
  | { tipo: 'hecho'; token: string }
  | { tipo: 'banco'; token: string; pedido: string; url: string; campos: Record<string, string> }

export interface PedidoPublico {
  numero: number
  estado: EstadoPedido
  total: number
  nombre: string
  lineas: { nombre: string; precio: number; cantidad: number }[]
}

export interface PedidoDelCms extends PedidoPublico {
  id: number
  email: string
  telefono: string
  metodo: string | null
  creadoEl: string
  pagadoEl: string | null
  entregadoEl: string | null
}

export type DatosProducto = Omit<Producto, 'id'>

export const catalogo = () => llamarApi<Catalogo>('/tienda', { auth: false })
export const comprar = (datos: DatosCompra) => llamarApi<ResultadoCompra>('/tienda/pedidos', { method: 'POST', json: datos, auth: false })
export const pedidoPublico = (token: string) => llamarApi<PedidoPublico>(`/tienda/pedidos/${token}`, { auth: false })

export const productos = () => llamarApi<Producto[]>('/tienda/admin/productos')
export const crearProducto = (d: DatosProducto) => llamarApi<Producto>('/tienda/admin/productos', { method: 'POST', json: d })
export const guardarProducto = (id: number, d: DatosProducto) => llamarApi<Producto>(`/tienda/admin/productos/${id}`, { method: 'PUT', json: d })
export const borrarProducto = (id: number) => llamarApi<{ message: string }>(`/tienda/admin/productos/${id}`, { method: 'DELETE' })
export const pedidosDelCms = (estado?: EstadoPedido) => llamarApi<PedidoDelCms[]>(`/tienda/admin/pedidos${estado ? `?estado=${estado}` : ''}`)
export const entregarPedido = (id: number) => llamarApi<{ message: string }>(`/tienda/admin/pedidos/${id}/entregar`, { method: 'POST' })
