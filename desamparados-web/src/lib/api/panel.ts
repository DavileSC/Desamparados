import { apiFetch } from './client'

/**
 * Valores cerrados que devuelve el backend. Se declaran aquí en vez de
 * importarlos de @prisma/client: esa dependencia es del servidor y no puede
 * entrar en el paquete del navegador. Si algún día se añade un valor nuevo en
 * el esquema, hay que reflejarlo aquí.
 */
export type EstadoRecibo = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'DEVUELTO' | 'ANULADO' | 'EXENTO'
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

export interface PanelResponse {
  generadoEn: string
  censo: {
    activos: number
    altas12m: number
    bajas12m: number
    sinNumeroHermano: number
    serieMensual: PuntoCenso[]
    porEdad: { tramo: string; total: number }[]
  }
  dinero: {
    porEstado: { estado: EstadoRecibo; total: number; importe: number }[]
    ejercicio: { anio: number; ingresos: number; gastos: number; saldo: number }
    serieMensual: { mes: string; ingresos: number; gastos: number }[]
    porCategoria: { categoria: string; tipo: TipoMovimiento; total: number }[]
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
}

export function getPanel() {
  return apiFetch<PanelResponse>('/panel')
}
