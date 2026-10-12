import { llamarApi } from './cliente'
import type { Articulo } from '../../domain/articulos'

/**
 * Valores cerrados que devuelve el backend. Se declaran aquí en vez de
 * importarlos de @prisma/client: esa dependencia es del servidor y no puede
 * entrar en el paquete del navegador. Si algún día se añade un valor nuevo en
 * el esquema, hay que reflejarlo aquí.
 */
export type EstadoRecibo = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'DEVUELTO' | 'ANULADO' | 'EXENTO' | 'REEMBOLSADO'
export type TipoMovimiento = 'INGRESO' | 'GASTO'
export type TipoEvento = 'CULTO' | 'PROCESION' | 'FORMACION' | 'ENSAYO' | 'REUNION' | 'SOCIAL' | 'OTRO'

export interface PuntoCenso {
  mes: string
  activos: number
}

export interface FilaRecuento {
  etiqueta: string
  total: number
}

/** Los cargos de la junta (los roles del CMS, sin el hermano raso). */
export type CargoJunta = 'ADMIN' | 'HERMANO_MAYOR' | 'SECRETARIA' | 'TESORERIA' | 'REDES' | 'ALBACERIA'

/** Un aviso que un cargo apunta a mano en el Inicio, pendiente hasta que alguien lo da por hecho. */
export interface AvisoJunta {
  id: number
  texto: string
  /** Un cargo, o null si es para toda la junta. */
  para: CargoJunta | null
  /** AAAA-MM-DD, o null sin fecha límite. */
  hasta: string | null
  urgente: boolean
  creadoPorId: number | null
  /** USER: lo puso un hermano desde su primer acceso («no es de mi familia»). */
  creadorRol: CargoJunta | 'USER'
  /** La ficha de la que trata (el «no es de mi familia»), para ir a ella desde el Inicio; null si no es de ninguna. */
  hermanoId: number | null
  createdAt: string
}

/** La foto del retablo (null = la de siempre) y el punto que no se recorta, en %. */
interface Retablo {
  foto: string | null
  x: number
  y: number
}

/** Los tiempos que se calculan solos cada año. */
export type TiempoCalculado = 'cuaresma' | 'semana-santa' | 'navidad'

/** Un tiempo del retablo con su foto: uno calculado, o unas fechas a mano (`MM-DD`). */
export type TiempoDelRetablo = { foto: string; x: number; y: number } & (
  | { tiempo: TiempoCalculado }
  | { tiempo: 'a-mano'; nombre: string; desde: string; hasta: string }
)

/** Hasta qué cuenta los días el retablo. */
export type CuentaAtras =
  | { tipo: 'proxima' }
  | { tipo: 'salida'; salidaId: number }
  | { tipo: 'acto'; eventoId: number }
  | { tipo: 'ninguna' }

/** Lo que se cuenta, ya resuelto: su nombre, su artículo (null en un acto) y su día `AAAA-MM-DD`. */
export interface CuentaDeHoy {
  nombre: string
  articulo: Articulo | null
  fecha: string
}

/** Lo que pinta el Inicio: la foto que toca hoy y la cuenta atrás (null: ninguna). */
export interface RetabloDeHoy extends Retablo {
  /** Opcional: un backend anterior no la manda, y entonces no hay cuenta atrás. */
  cuenta?: CuentaDeHoy | null
}

/** Lo que se puede elegir en «Ajustes del Inicio». Null: su módulo está apagado. */
export interface OpcionesRetablo {
  proxima: CuentaDeHoy | null
  salidas: { id: number; nombre: string; articulo: Articulo; fecha: string | null }[] | null
  actos: { id: number; nombre: string; fecha: string }[] | null
}

export interface AjustesRetablo extends Retablo {
  tiempos: TiempoDelRetablo[]
  cuenta: CuentaAtras
}

export interface PanelResponse {
  generadoEn: string
  /** Ejercicio al que corresponden el dinero, la procesión y la serie del censo. */
  ejercicio: { anio: number; cerrado: boolean }
  censo: {
    activos: number
    altas12m: number
    bajas12m: number
    sinNumeroHermano: number
    serieMensual: PuntoCenso[]
    movimientosMensuales: { mes: string; altas: number; bajas: number }[]
    porEdad: { tramo: string; total: number }[]
  }
  dinero: {
    porEstado: { estado: EstadoRecibo; total: number; importe: number }[]
    /** Los devueltos del ejercicio que aún no se han reemitido: los que de verdad quedan por cobrar. */
    /** Opcional: un backend anterior no lo manda, y el CMS no puede romperse por eso (cuenta cero). */
    devueltosPendientes?: { total: number; importe: number }
    /** Lo que sigue sin cobrarse de ejercicios anteriores. */
    anterioresPorCobrar?: { total: number; importe: number }
    ejercicio: { anio: number; ingresos: number; gastos: number; saldo: number }
    serieMensual: { mes: string; ingresos: number; gastos: number }[]
    porCategoria: { categoria: string; tipo: TipoMovimiento; total: number; importe: number }[]
  }
  procesion: {
    anio: number
    papeletas: number
    porAnio: { anio: number; total: number }[]
    porPuesto: FilaRecuento[]
    porTalla: FilaRecuento[]
    porAlturaHombro: { tramo: string; total: number }[]
  }
  actividad: {
    proximosEventos: { id: number; title: string; startDate: string; type: TipoEvento }[]
    noticias: { publicadas: number; borradores: number }
    publicaciones: { total: number; ultima: string | null }
    reparto: { turnosProximos: number; citasReservadas: number; capacidadEstimada: number }
  }
  /** El mes en curso para el calendario del Inicio: sus actos y los días de reparto. */
  calendario: {
    /** AAAA-MM */
    mes: string
    eventos: { id: number; title: string; startDate: string; type: TipoEvento }[]
    /** AAAA-MM-DD, en Madrid. */
    diasDeReparto: string[]
  }
  /** Todos los actos del año natural en marcha (1 de enero – 31 de diciembre), pasados y por venir. */
  anio: {
    /** `location` es opcional: un backend anterior no lo manda. */
    eventos: { id: number; title: string; startDate: string; type: TipoEvento; location?: string | null }[]
  }
  /** Opcionales: un backend anterior no los manda (sin avisos y con la foto de siempre). */
  avisos?: AvisoJunta[]
  retablo?: RetabloDeHoy
}

interface NuevoAviso {
  texto: string
  para: CargoJunta | null
  hasta: string | null
  urgente: boolean
}

export function crearAviso(aviso: NuevoAviso) {
  return llamarApi<AvisoJunta>('/panel/avisos', { method: 'POST', json: aviso })
}

export function darAvisoPorHecho(id: number) {
  return llamarApi<void>(`/panel/avisos/${id}/hecho`, { method: 'POST' })
}

export function traerRetablo() {
  return llamarApi<AjustesRetablo & { opciones: OpcionesRetablo }>('/panel/retablo')
}

export function guardarRetablo(ajustes: AjustesRetablo) {
  return llamarApi<AjustesRetablo & { opciones: OpcionesRetablo }>('/panel/retablo', { method: 'PUT', json: ajustes })
}

/** Sin año, el ejercicio en curso. */
export function traerPanelDeHoy(anio?: number) {
  return llamarApi<PanelResponse>(anio === undefined ? '/panel' : `/panel?anio=${anio}`)
}
