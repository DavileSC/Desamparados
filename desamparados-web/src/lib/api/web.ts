import { llamarApi } from './cliente'

/**
 * Si la web pública está abierta o enseña «Próximamente» (Sistema → Abrir la
 * web). La misma forma que `EstadoDeLaWeb` de la API (domain/web-abierta.ts).
 */
export interface EstadoDeLaWeb {
  abierta: boolean
  /** El texto de «Próximamente»; `null`, el de siempre. */
  mensaje: string | null
  /** El día de la presentación, AAAA-MM-DD, si ya se sabe. */
  fecha: string | null
}

export const CLAVE_ESTADO_DE_LA_WEB = ['web', 'estado'] as const

/** El mismo tope que la API: uno más largo es un 400. */
export const TOPE_MENSAJE_PROXIMAMENTE = 280

/** Sin sesión: la web lo pregunta antes de pintar la página. */
export const estadoDeLaWeb = () => llamarApi<EstadoDeLaWeb>('/web', { auth: false })

export const guardarEstadoDeLaWeb = (estado: EstadoDeLaWeb) =>
  llamarApi<EstadoDeLaWeb>('/cms/web', { method: 'PUT', json: estado })
