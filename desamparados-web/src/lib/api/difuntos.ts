import { llamarApi } from './cliente'

export type TipoSufragio = 'MISA_FUNERAL' | 'MISA_ANIVERSARIO' | 'MISA_SUFRAGIO' | 'ORACION'

export const NOMBRE_SUFRAGIO: Record<TipoSufragio, string> = {
  MISA_FUNERAL: 'Misa funeral',
  MISA_ANIVERSARIO: 'Misa de aniversario',
  MISA_SUFRAGIO: 'Misa de sufragio',
  ORACION: 'Oración',
}

/** El próximo aniversario: el día (AAAA-MM-DD), los años que se cumplen y cuántos días faltan. */
export interface Aniversario { dia: string; anios: number; faltan: number }

export interface Difunto {
  id: number
  nombre: string
  apellidos: string
  sexo: 'HOMBRE' | 'MUJER' | null
  fechaDefuncion: string
  aniosDeHermano: number
  aniversario: Aniversario
  /** Cuántos sufragios tiene apuntados. */
  sufragios: number
}

export interface Sufragio {
  id: number
  tipo: TipoSufragio
  nombreTipo: string
  fecha: string
  lugar: string | null
  notas: string | null
  eventoId: number | null
  familiaAvisada: string | null
}

export interface FichaDifunto extends Omit<Difunto, 'sufragios'> {
  fechaAlta: string
  /** A quién escribir en nombre de la familia, si hay a quién. Nunca a la cuenta del difunto. */
  familia: { nombre: string | null; email: string } | null
  sufragios: Sufragio[]
}

export interface NuevoSufragio {
  tipo: TipoSufragio
  /** AAAA-MM-DDTHH:mm, en Madrid. */
  fecha: string
  lugar?: string | null
  notas?: string | null
  enAgenda?: boolean
  avisarA?: string | null
}

export const difuntos = (q = '') => llamarApi<Difunto[]>(`/hermanos/admin/difuntos${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
export const aniversarios = () => llamarApi<Difunto[]>('/hermanos/admin/difuntos/aniversarios')
export const fichaDifunto = (id: number) => llamarApi<FichaDifunto>(`/hermanos/admin/difuntos/${id}`)
export const fijarDefuncion = (id: number, fecha: string) =>
  llamarApi<{ message: string }>(`/hermanos/admin/difuntos/${id}/defuncion`, { method: 'PUT', json: { fecha } })
export const crearSufragio = (id: number, sufragio: NuevoSufragio) =>
  llamarApi<{ id: number; eventoId: number | null; familiaAvisada: boolean }>(`/hermanos/admin/difuntos/${id}/sufragios`, { method: 'POST', json: sufragio })
export const borrarSufragio = (id: number) => llamarApi<{ message: string }>(`/hermanos/admin/sufragios/${id}`, { method: 'DELETE' })
export const enviarPesame = (id: number, email: string) =>
  llamarApi<{ message: string }>(`/hermanos/admin/difuntos/${id}/pesame`, { method: 'POST', json: { email } })
