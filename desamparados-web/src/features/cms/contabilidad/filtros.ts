import type { FiltrosContables, MetodoPago, TipoApunte } from '../../../lib/api/contabilidad'
import { aDia } from '../../../lib/fechas'

export const PERIODOS = [
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: '3meses', etiqueta: 'Últimos 3 meses' },
  { valor: 'anio', etiqueta: 'Año en curso' },
  { valor: 'anioAnterior', etiqueta: 'Año anterior' },
  { valor: 'todo', etiqueta: 'Todo el histórico' },
  { valor: 'personalizado', etiqueta: 'Fechas a elegir' },
] as const

export type Periodo = (typeof PERIODOS)[number]['valor']
export const PERIODO_POR_DEFECTO: Periodo = 'anio'

export const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'BIZUM', etiqueta: 'Bizum' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'DOMICILIACION', etiqueta: 'Domiciliación' },
]

/** Lo que eligió el usuario, tal y como vive en la URL. Cadena vacía = sin filtro. */
export interface FiltrosUi {
  tipo: 'TODO' | TipoApunte
  periodo: Periodo
  desde: string
  hasta: string
  categoria: string
  metodo: '' | MetodoPago
  q: string
  /** Los apuntes de un recibo, al llegar desde Tesorería. Vacío: todos. */
  recibo: string
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/
/** `AAAA-MM-DD` del día local (el del navegador, que en el CMS es el de Madrid). */
export const dia = aDia

/**
 * Unas fechas a elegir con el «hasta» antes del «desde». El servidor lo
 * rechaza con 400 (antes pintaba 1.201 meses vacíos), así que la pantalla ni
 * lo pide: avisa en el campo y espera a que se corrija.
 */
export function fechasInvertidas(ui: Pick<FiltrosUi, 'periodo' | 'desde' | 'hasta'>): boolean {
  return ui.periodo === 'personalizado' && Boolean(ui.desde && ui.hasta) && ui.desde > ui.hasta
}

/**
 * Fechas de cada periodo, contadas desde hoy. Los que están en curso acaban hoy
 * y no a fin de mes o de año: así se comparan con el mismo tramo del año anterior.
 */
export function rangoDePeriodo(periodo: Exclude<Periodo, 'personalizado'>, hoy = new Date()): { desde?: string; hasta?: string } {
  const anio = hoy.getFullYear()
  switch (periodo) {
    case 'mes': return { desde: dia(new Date(anio, hoy.getMonth(), 1)), hasta: dia(hoy) }
    case '3meses': return { desde: dia(new Date(anio, hoy.getMonth() - 2, 1)), hasta: dia(hoy) }
    case 'anio': return { desde: `${anio}-01-01`, hasta: dia(hoy) }
    case 'anioAnterior': return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` }
    case 'todo': return {}
  }
}

export function leerFiltrosUrl(params: URLSearchParams): FiltrosUi {
  const tipo = params.get('tipo')
  const periodo = params.get('periodo')
  const metodo = params.get('metodo')
  const desde = params.get('desde') ?? ''
  const hasta = params.get('hasta') ?? ''
  const categoria = params.get('categoria') ?? ''
  return {
    tipo: tipo === 'INGRESO' || tipo === 'GASTO' ? tipo : 'TODO',
    periodo: PERIODOS.some((p) => p.valor === periodo) ? (periodo as Periodo) : PERIODO_POR_DEFECTO,
    desde: FECHA.test(desde) ? desde : '',
    hasta: FECHA.test(hasta) ? hasta : '',
    categoria: /^\d+$/.test(categoria) ? categoria : '',
    metodo: METODOS.some((m) => m.valor === metodo) ? (metodo as MetodoPago) : '',
    q: params.get('q')?.trim() ?? '',
    recibo: /^[1-9]\d{0,9}$/.test(params.get('recibo') ?? '') ? params.get('recibo')! : '',
  }
}

export function aFiltrosApi(ui: FiltrosUi, hoy = new Date()): FiltrosContables {
  // Los apuntes de un recibo se ven todos, caigan en el periodo que caigan:
  // un cobro de marzo y su devolución de mayo no se separan.
  if (ui.recibo) return { recibo: Number(ui.recibo) }
  const rango = ui.periodo === 'personalizado'
    ? { ...(ui.desde && { desde: ui.desde }), ...(ui.hasta && { hasta: ui.hasta }) }
    : rangoDePeriodo(ui.periodo, hoy)
  return {
    ...(ui.tipo !== 'TODO' && { tipo: ui.tipo }),
    ...rango,
    ...(ui.categoria && { categorias: [Number(ui.categoria)] }),
    ...(ui.metodo && { metodo: ui.metodo }),
    ...(ui.q && { q: ui.q }),
  }
}
