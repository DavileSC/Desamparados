import { llamarApi } from './cliente'

/** Un campo que se rellena solo ({{nombre}}) o un bloque fijo que pone el sistema ([[papeleta]]). */
export interface CampoDeUso { clave: string; ayuda: string; ejemplo?: string }
export interface BloqueDeUso { clave: string; ayuda: string; obligatorio?: boolean }

export interface TextoDePlantilla { asunto: string; titulo: string; cuerpo: string; despedida: string }

export interface ResumenDePlantilla { id: number; nombre: string; asunto: string; enUso: boolean; autorNombre: string | null; updatedAt: string }

/** Un correo (un uso) con sus plantillas. Sin ninguna en uso, sale el original. */
export interface UsoDeCorreo {
  clave: string
  grupo: string
  nombre: string
  descripcion: string
  /** Las libres son para empezar un aviso del boletín: no se ponen en uso. */
  libre: boolean
  campos: CampoDeUso[]
  bloques: BloqueDeUso[]
  original: TextoDePlantilla
  plantillas: ResumenDePlantilla[]
}

export interface CatalogoDeEmails { comunes: CampoDeUso[]; usos: UsoDeCorreo[] }

interface Plantilla extends TextoDePlantilla { id: number; nombre: string; uso: string; enUso: boolean }

export type DatosPlantilla = TextoDePlantilla & { nombre: string; uso: string }

export const catalogoDeEmails = () => llamarApi<CatalogoDeEmails>('/plantillas-correo')
export const traerPlantilla = (id: number) => llamarApi<Plantilla>(`/plantillas-correo/${id}`)
export const crearPlantilla = (d: DatosPlantilla) => llamarApi<Plantilla>('/plantillas-correo', { method: 'POST', json: d })
export const guardarPlantilla = (id: number, d: DatosPlantilla) => llamarApi<Plantilla>(`/plantillas-correo/${id}`, { method: 'PUT', json: d })
export const borrarPlantilla = (id: number) => llamarApi<{ message: string }>(`/plantillas-correo/${id}`, { method: 'DELETE' })
/** Pone en uso una plantilla de ese correo, o el texto original con `id = null`. */
export const usarPlantilla = (uso: string, id: number | null) => llamarApi<CatalogoDeEmails>('/plantillas-correo/usar', { method: 'POST', json: { uso, id } })
export const vistaPreviaDePlantilla = (uso: string, t: TextoDePlantilla) =>
  llamarApi<{ asunto: string; html: string; problemas: string[] }>('/plantillas-correo/vista-previa', { method: 'POST', json: { uso, ...t } })
export const pruebaDePlantilla = (uso: string, t: TextoDePlantilla) =>
  llamarApi<{ message: string }>('/plantillas-correo/prueba', { method: 'POST', json: { uso, ...t } })

/** Las plantillas libres, con el cuerpo ya en HTML para el editor del boletín. */
export const plantillasLibres = () => llamarApi<{ id: number; nombre: string; asunto: string; cuerpo: string }[]>('/plantillas-correo/libres')
