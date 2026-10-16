import { llamarApi } from './cliente'

export type TipoComunicado = 'BOLETIN' | 'AVISO'
type EstadoComunicado = 'BORRADOR' | 'ENVIANDO' | 'ENVIADO'

/** A quién va, además de ser activo (y suscrito, en el boletín). Vacío no filtra. */
export interface Segmento {
  /** El id de la salida. */
  conPapeleta?: number | null
  /**
   * El id de la salida: quien tiene su papeleta del año o la ha pedido y aún
   * no la ha recogido (la solicitud PENDIENTE). Para avisar de un cambio de
   * fecha o de cobro a todos los que cuentan con ella.
   */
  apuntadosA?: number | null
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
  /** `alMovil`: los que recibieron el aviso en el móvil en vez del correo. */
  /** `rebotados`: salieron, pero el servicio de envío avisó después de que no llegaron. */
  envios: { enviados: number; fallidos: number; rebotados: number; pendientes: number; alMovil: number }
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
/** Cómo va un envío a muchos (un comunicado o la apertura de papeletas). */
export interface EnvioEnMarcha {
  clave: string
  tipo: 'comunicado' | 'apertura'
  titulo: string
  desde: string
  alMovil: number
  enviados: number
  fallidos: number
  rebotados: number
  pendientes: number
  total: number
  estado: 'EN_COLA' | 'ENVIANDO' | 'SIGUE_MANANA' | 'TERMINADO'
}

/** Los correos de hoy frente al tope, y los envíos en marcha y de la última semana. */
export const enviosEnMarcha = () => llamarApi<{ hoy: { enviados: number; tope: number }; envios: EnvioEnMarcha[] }>('/comunicados/envios')

export const reintentarFallidos = (id: number) => llamarApi<{ message: string }>(`/comunicados/${id}/reintentar`, { method: 'POST' })

/**
 * La baja del boletín desde el enlace del correo: sin sesión. Va por el núcleo
 * (`/boletin`), no por Comunicados: apagar el módulo no deja sin baja a quien
 * ya recibió un boletín.
 */
export const bajaDelBoletin = (token: string) =>
  llamarApi<{ message: string }>('/boletin/baja', { method: 'POST', json: { token }, auth: false })
