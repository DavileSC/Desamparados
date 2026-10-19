import { llamarApi } from './cliente'

/** Un campo que se rellena solo ({{nombre}}) o un bloque fijo que pone el sistema (la papeleta). */
export interface CampoDeUso { clave: string; etiqueta: string; ayuda: string; ejemplo?: string }
export interface BloqueDeUso { clave: string; ayuda: string; obligatorio?: boolean }

/**
 * Las piezas de un correo, como las guarda el servidor
 * (backend `domain/plantillas-correo.ts`). Dentro del texto, `{{clave}}` es
 * un campo.
 */
export interface Trozo { texto: string; negrita?: boolean; cursiva?: boolean; enlace?: string }
export type Linea = Trozo[]
export type PiezaDeTexto = { tipo: 'parrafo'; trozos: Linea } | { tipo: 'lista'; elementos: Linea[] }
export type Pieza =
  | PiezaDeTexto
  | { tipo: 'recuadro'; titulo: string; piezas: PiezaDeTexto[] }
  | { tipo: 'oracion'; trozos: Linea }
  | { tipo: 'boton'; texto: string; enlace: string }
  | { tipo: 'foto'; src: string; alt: string; pie: string }
  | { tipo: 'separador' }
  | { tipo: 'fijo'; clave: string }

export interface PlantillaDeCorreo { asunto: string; resumen: string; titulo: string; contenido: Pieza[]; despedida: string }

export interface ResumenDePlantilla { id: number; nombre: string; asunto: string; enUso: boolean; autorNombre: string | null; updatedAt: string }

/** Un correo (un uso) con sus plantillas. Sin ninguna en uso, sale el original. */
export interface UsoDeCorreo {
  clave: string
  grupo: string
  nombre: string
  descripcion: string
  /** La línea pequeña sobre el título («Secretaría»): la pone el correo, no la plantilla. */
  antetitulo: string
  /** Quién firma: el cargo, no la persona. */
  firma: string
  /** Las libres son para empezar un aviso del boletín: no se ponen en uso. */
  libre: boolean
  campos: CampoDeUso[]
  bloques: BloqueDeUso[]
  original: PlantillaDeCorreo
  plantillas: ResumenDePlantilla[]
}

export interface CatalogoDeEmails { conCabecera: boolean; comunes: CampoDeUso[]; usos: UsoDeCorreo[] }

export interface Plantilla extends PlantillaDeCorreo { id: number; nombre: string; uso: string; enUso: boolean; autorNombre: string | null; updatedAt: string }

export type DatosPlantilla = PlantillaDeCorreo & { nombre: string; uso: string }

export interface VersionDePlantilla { id: number; autorNombre: string; createdAt: string; datos: PlantillaDeCorreo }

export interface VistaPrevia { asunto: string; html: string; problemas: string[]; avisos: string[] }

export const catalogoDeEmails = () => llamarApi<CatalogoDeEmails>('/plantillas-correo')
export const traerPlantilla = (id: number) => llamarApi<Plantilla>(`/plantillas-correo/${id}`)
export const versionesDePlantilla = (id: number) => llamarApi<VersionDePlantilla[]>(`/plantillas-correo/${id}/versiones`)
export const crearPlantilla = (d: DatosPlantilla) => llamarApi<Plantilla>('/plantillas-correo', { method: 'POST', json: d })
export const guardarPlantilla = (id: number, d: DatosPlantilla) => llamarApi<Plantilla>(`/plantillas-correo/${id}`, { method: 'PUT', json: d })
export const borrarPlantilla = (id: number) => llamarApi<{ message: string }>(`/plantillas-correo/${id}`, { method: 'DELETE' })
/** Pone en uso una plantilla de ese correo, o el texto original con `id = null`. */
export const usarPlantilla = (uso: string, id: number | null) => llamarApi<CatalogoDeEmails>('/plantillas-correo/usar', { method: 'POST', json: { uso, id } })
export const vistaPreviaDePlantilla = (uso: string, p: PlantillaDeCorreo) =>
  llamarApi<VistaPrevia>('/plantillas-correo/vista-previa', { method: 'POST', json: { uso, ...p } })
export const pruebaDePlantilla = (uso: string, p: PlantillaDeCorreo) =>
  llamarApi<{ message: string }>('/plantillas-correo/prueba', { method: 'POST', json: { uso, ...p } })

/** El escudo del membrete y la cabecera de los correos, como `src` de una imagen. */
export const imagenDelMembrete = (pieza: 'escudo' | 'cabecera') => `/api/plantillas-correo/marca/${pieza}`

/** Las plantillas libres, con el cuerpo ya en HTML para el editor del boletín. */
export const plantillasLibres = () => llamarApi<{ id: number; nombre: string; asunto: string; cuerpo: string }[]>('/plantillas-correo/libres')
