import { llamarApi } from './cliente'

export type TipoComunicado = 'BOLETIN' | 'AVISO'
type EstadoComunicado = 'BORRADOR' | 'ENVIANDO' | 'ENVIADO'

/** A quién va, además de ser activo (y suscrito, en el boletín). Vacío no filtra. */
export interface Segmento {
  /** El id de la salida. */
  conPapeleta?: number | null
  conDeuda?: boolean
  edad?: 'MAYORES' | 'MENORES' | null
  poblacion?: string | null
}

interface Comunicado {
  id: number
  tipo: TipoComunicado
  asunto: string
  estado: EstadoComunicado
  segmento: Segmento
  /** El segmento dicho en castellano. */
  para: string
  enviadoEl: string | null
  autorNombre: string | null
  createdAt: string
  updatedAt: string
}

export interface ComunicadoEnLista extends Comunicado {
  envios: { enviados: number; fallidos: number; pendientes: number }
}

export interface ComunicadoCompleto extends Comunicado {
  cuerpo: string
}

export interface DatosComunicado {
  tipo: TipoComunicado
  asunto: string
  cuerpo: string
  segmento: Segmento
}

export const comunicados = () => llamarApi<ComunicadoEnLista[]>('/comunicados')
export const comunicado = (id: number) => llamarApi<ComunicadoCompleto>(`/comunicados/${id}`)
export const crearComunicado = (datos: DatosComunicado) => llamarApi<ComunicadoCompleto>('/comunicados', { method: 'POST', json: datos })
export const guardarComunicado = (id: number, datos: DatosComunicado) => llamarApi<ComunicadoCompleto>(`/comunicados/${id}`, { method: 'PUT', json: datos })
export const borrarComunicado = (id: number) => llamarApi<void>(`/comunicados/${id}`, { method: 'DELETE' })

/** A cuántas direcciones llegaría, y cuántas fichas del segmento no tienen correo. */
export const destinatariosDe = (tipo: TipoComunicado, segmento: Segmento) =>
  llamarApi<{ para: string; fichas: number; correos: number; sinCorreo: number }>('/comunicados/destinatarios', { method: 'POST', json: { tipo, segmento } })

export const enviarPrueba = (id: number) => llamarApi<{ message: string }>(`/comunicados/${id}/prueba`, { method: 'POST' })
export const enviarComunicado = (id: number) => llamarApi<{ message: string; destinatarios: number }>(`/comunicados/${id}/enviar`, { method: 'POST' })
export const reintentarFallidos = (id: number) => llamarApi<{ message: string }>(`/comunicados/${id}/reintentar`, { method: 'POST' })

/** La baja del boletín desde el enlace del correo: sin sesión. */
export const bajaDelBoletin = (token: string) =>
  llamarApi<{ message: string }>('/comunicados/baja-boletin', { method: 'POST', json: { token }, auth: false })
