import { llamarApi, traerArchivo } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type TipoApunte = 'INGRESO' | 'GASTO'
export type MetodoPago = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'

export interface Balance { ingresos: number; gastos: number; balanceTotal: number }
export interface Category {
  id: number
  nombre: string
  tipo: TipoApunte
  /** Desactivada, deja de ofrecerse al apuntar; sus apuntes siguen en el libro. */
  activa?: boolean
  /** La usan los recibos al cobrarse o devolverse: no se puede renombrar. */
  deRecibos?: boolean
  /** Apuntes e importe en el año natural en curso, para la gestión de categorías. */
  usoAnio?: { apuntes: number; importe: number }
}
export interface Transaction {
  id: number
  tipo: TipoApunte
  concepto: string
  importe: number | string
  fecha: string
  metodoPago?: MetodoPago | null
  categoriaId?: number
  /** Con recibo, el apunte se corrige desde el recibo; sin él, es manual y se corrige aquí. */
  reciboId?: number | null
  /** Igual con la lotería: la liquidación de un talonario o la compra de los décimos de ese sorteo. */
  talonarioLoteria?: { sorteoId: number } | null
  compraDeLoteria?: { id: number } | null
  categoria: { nombre: string }
  hermano: { nombre: string; apellidos: string } | null
}

/** Lo que se manda al apuntar o corregir a mano. `fecha` en `AAAA-MM-DD`. */
export interface ApunteManual {
  tipo: TipoApunte
  categoriaId: number
  concepto: string
  importe: number
  fecha: string
  metodoPago: MetodoPago
}

/** Los mismos filtros sirven al libro mayor y al resumen: las cifras cuadran con la lista. */
export interface FiltrosContables {
  tipo?: TipoApunte
  /** `AAAA-MM-DD`, incluido. */
  desde?: string
  hasta?: string
  categorias?: number[]
  metodo?: MetodoPago
  q?: string
  /** Solo los apuntes de este recibo: el enlace desde Tesorería. */
  recibo?: number
}

export interface ResumenContable {
  totales: { ingresos: number; gastos: number; resultado: number; apuntesIngreso: number; apuntesGasto: number }
  /** El mismo tramo un año antes; `null` si el periodo no tiene principio y fin. */
  anterior: { desde: string; hasta: string; ingresos: number; gastos: number } | null
  serie: { granularidad: 'mes' | 'anio'; puntos: { clave: string; ingresos: number; gastos: number }[] }
  categorias: { id: number; nombre: string; tipo: TipoApunte; total: number; apuntes: number }[]
  /** Lo que Tesorería tiene aún por cobrar (pendiente, en el banco y devuelto sin reemitir), de todos los años y sin los filtros. */
  porCobrar: { importe: number; recibos: number; enElBanco: number; devueltos: number }
}

export function paramsFiltros(filtros: FiltrosContables): URLSearchParams {
  const params = new URLSearchParams()
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.desde) params.set('desde', filtros.desde)
  if (filtros.hasta) params.set('hasta', filtros.hasta)
  if (filtros.categorias?.length) params.set('categorias', filtros.categorias.join(','))
  if (filtros.metodo) params.set('metodo', filtros.metodo)
  if (filtros.q) params.set('q', filtros.q)
  if (filtros.recibo) params.set('recibo', String(filtros.recibo))
  return params
}

export const balanceDelEjercicio = () => llamarApi<Balance>('/transacciones/balance')
/** El orden solo es del libro: al resumen le da igual en qué orden se sumen los apuntes. */
export const libroMayor = (pagina: { pagina: number; porPagina: number }, filtros: FiltrosContables = {}, orden?: string) => {
  const filtrado = paramsFiltros(filtros).toString()
  return llamarApi<RespuestaPaginada<Transaction>>(`/transacciones/libro-mayor?${paramsPagina(pagina, { orden })}${filtrado ? `&${filtrado}` : ''}`)
}
export const resumenDeTesoreria = (filtros: FiltrosContables = {}) => {
  const filtrado = paramsFiltros(filtros).toString()
  return llamarApi<ResumenContable>(`/transacciones/resumen${filtrado ? `?${filtrado}` : ''}`)
}
/** `todas`: también las desactivadas, que la gestión y los filtros del histórico necesitan ver. */
export const listarCategorias = (tipo?: TipoApunte, todas = false) => {
  const params = new URLSearchParams()
  if (tipo) params.set('tipo', tipo)
  if (todas) params.set('todas', 'true')
  const consulta = params.toString()
  return llamarApi<Category[]>(`/transacciones/categorias${consulta ? `?${consulta}` : ''}`)
}
export const crearApunte = (json: ApunteManual) => llamarApi<{ message: string }>('/transacciones', { method: 'POST', json })
/** Solo apuntes manuales: los de un recibo responden 409 y se corrigen desde el recibo. */
export const actualizarApunte = (id: number, json: ApunteManual) => llamarApi<{ message: string }>(`/transacciones/${id}`, { method: 'PUT', json })
export const eliminarApunte = (id: number) => llamarApi<{ message: string }>(`/transacciones/${id}`, { method: 'DELETE' })
export const crearCategoriaDeApunte = (json: { nombre: string; tipo: TipoApunte }) => llamarApi<{ message: string }>('/transacciones/categorias', { method: 'POST', json })
export const renombrarCategoria = (id: number, nombre: string) => llamarApi<{ message: string }>(`/transacciones/categorias/${id}`, { method: 'PUT', json: { nombre } })
export const cambiarEstadoCategoria = (id: number, activa: boolean) => llamarApi<{ message: string }>(`/transacciones/categorias/${id}/activa`, { method: 'PATCH', json: { activa } })

// --- La partida doble ---

export interface CuentaDelPlan { codigo: string; nombre: string }

export interface PlanDeCuentas {
  cuentas: CuentaDelPlan[]
  categorias: { id: number; nombre: string; tipo: 'INGRESO' | 'GASTO'; activa: boolean; cuenta: string; nombreCuenta: string; propuesta: boolean }[]
}

export interface EjercicioContable {
  anio: number
  asientos: number
  /** Categorías que aún usan la cuenta propuesta por su nombre. */
  categoriasPropuestas: number
  sumas: { cuenta: string; nombre: string; debe: number; haber: number; saldo: number }[]
  resultados: {
    ingresos: { cuenta: string; nombre: string; importe: number }[]
    gastos: { cuenta: string; nombre: string; importe: number }[]
    totalIngresos: number
    totalGastos: number
    excedente: number
  }
}

export interface PaginaDelDiario {
  total: number
  pagina: number
  porPagina: number
  asientos: { numero: number; apunteId: number; fecha: string; concepto: string; lineas: { cuenta: string; nombre: string; debe: number; haber: number }[] }[]
}

export const planDeCuentas = () => llamarApi<PlanDeCuentas>('/transacciones/partida-doble/plan')
export const asignarCuenta = (categoriaId: number, cuenta: string | null) =>
  llamarApi<PlanDeCuentas>(`/transacciones/partida-doble/categorias/${categoriaId}`, { method: 'PUT', json: { cuenta } })
export const ejercicioContable = (anio: number) => llamarApi<EjercicioContable>(`/transacciones/partida-doble/${anio}`)
export const libroDiario = (anio: number, pagina: number, porPagina = 50) =>
  llamarApi<PaginaDelDiario>(`/transacciones/partida-doble/${anio}/diario?pagina=${pagina}&porPagina=${porPagina}`)
export const contabilidadEnExcel = (anio: number) => traerArchivo(`/transacciones/partida-doble/${anio}/excel`)
