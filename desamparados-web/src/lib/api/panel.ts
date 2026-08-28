import { apiFetch } from './client'

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
    porEstado: { estado: string; total: number; importe: number }[]
    ejercicio: { anio: number; ingresos: number; gastos: number; saldo: number }
    serieMensual: { mes: string; ingresos: number; gastos: number }[]
    porCategoria: { categoria: string; tipo: string; total: number }[]
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
    proximosEventos: { id: number; title: string; startDate: string; type: string }[]
    noticias: { publicadas: number; borradores: number }
    publicaciones: { total: number; ultima: string | null }
    reparto: { turnosProximos: number; citasReservadas: number; capacidadEstimada: number }
  }
}

export function getPanel() {
  return apiFetch<PanelResponse>('/panel')
}
