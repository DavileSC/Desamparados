import { llamarApi } from './cliente'

export interface Producto {
  id: number
  nombre: string
  descripcion: string
  precio: number
  foto: string | null
  /** Las de más, que se ven en la galería al pulsar la foto. */
  fotos: FotoDeProducto[]
  /** Null: sin límite. Con tallas no se usa: cuenta lo de cada talla. */
  existencias: number | null
  activo: boolean
  orden: number
  /** Vacío: sin tallas. Con alguna, se compra y se vende siempre por talla. */
  tallas: TallaDeProducto[]
  /** Null: sin categoría (sale solo en «Todo»). */
  categoriaId: number | null
  /** La pieza que la tienda enseña en grande al entrar (la primera, si hay varias). */
  destacado: boolean
  /** Cuándo se dio de alta (ISO), para ordenar por «Lo más reciente». */
  creadoEl: string
}

/** Una categoría, como la ve la tienda: solo las que tienen algo a la venta, en su orden. */
export interface CategoriaDeTienda { id: number; nombre: string }

/** Una categoría en el CMS: con su orden y cuántos productos lleva. */
export interface CategoriaDelCms extends CategoriaDeTienda { orden: number; productos: number }

export interface FotoDeProducto { url: string; pie: string }

export interface TallaDeProducto {
  id: number
  nombre: string
  /** Null: sin límite. */
  existencias: number | null
}

/** Las tallas que admite un producto (el tope del servidor). */
export const MAX_TALLAS = 20

/** Las fotos de más que admite un producto, además de la principal (el tope del servidor). */
export const MAX_FOTOS_PRODUCTO = 8

export type MetodoEnLinea = 'TARJETA' | 'BIZUM'
export type EstadoPedido = 'PENDIENTE_PAGO' | 'PAGADO' | 'ENTREGADO' | 'CANCELADO'

export interface Catalogo { productos: Producto[]; categorias: CategoriaDeTienda[]; pagoDisponible: boolean; metodos: MetodoEnLinea[] }

export interface DatosCompra {
  nombre: string
  email: string
  telefono: string
  metodo: MetodoEnLinea
  lineas: { productoId: number; tallaId?: number; cantidad: number }[]
}

export type ResultadoCompra =
  | { tipo: 'hecho'; token: string }
  | { tipo: 'banco'; token: string; pedido: string; url: string; campos: Record<string, string> }

export interface PedidoPublico {
  numero: number
  estado: EstadoPedido
  total: number
  nombre: string
  lineas: { nombre: string; talla: string | null; precio: number; cantidad: number }[]
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

export type DatosProducto = Omit<Producto, 'id' | 'tallas' | 'creadoEl'> & {
  /** Las que traen `id` ya estaban; las que faltan se borran. */
  tallas: { id?: number; nombre: string; existencias: number | null }[]
}

export const catalogo = () => llamarApi<Catalogo>('/tienda', { auth: false })
export const comprar = (datos: DatosCompra) => llamarApi<ResultadoCompra>('/tienda/pedidos', { method: 'POST', json: datos, auth: false })
export const pedidoPublico = (token: string) => llamarApi<PedidoPublico>(`/tienda/pedidos/${token}`, { auth: false })

export const productos = () => llamarApi<Producto[]>('/tienda/admin/productos')
export const crearProducto = (d: DatosProducto) => llamarApi<Producto>('/tienda/admin/productos', { method: 'POST', json: d })
export const guardarProducto = (id: number, d: DatosProducto) => llamarApi<Producto>(`/tienda/admin/productos/${id}`, { method: 'PUT', json: d })
export const borrarProducto = (id: number) => llamarApi<{ message: string }>(`/tienda/admin/productos/${id}`, { method: 'DELETE' })
export const categoriasDelCms = () => llamarApi<CategoriaDelCms[]>('/tienda/admin/categorias')
export const crearCategoria = (nombre: string) => llamarApi<CategoriaDelCms>('/tienda/admin/categorias', { method: 'POST', json: { nombre } })
export const renombrarCategoria = (id: number, nombre: string) => llamarApi<CategoriaDelCms>(`/tienda/admin/categorias/${id}`, { method: 'PUT', json: { nombre } })
export const ordenarCategorias = (ids: number[]) => llamarApi<CategoriaDelCms[]>('/tienda/admin/categorias/orden', { method: 'PUT', json: { ids } })
export const borrarCategoria = (id: number) => llamarApi<{ message: string }>(`/tienda/admin/categorias/${id}`, { method: 'DELETE' })
export const pedidosDelCms = (estado?: EstadoPedido) => llamarApi<PedidoDelCms[]>(`/tienda/admin/pedidos${estado ? `?estado=${estado}` : ''}`)
export const entregarPedido = (id: number) => llamarApi<{ message: string }>(`/tienda/admin/pedidos/${id}/entregar`, { method: 'POST' })
