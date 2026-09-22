import type { Publicacion } from '../../types'
import { llamarApi } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export interface PublicacionDeLaApi {
  id: number
  titulo: string
  descripcion: string | null
  imagenUrl: string | null
  archivoUrl: string
  fecha: string
  categoria: Publicacion['categoria']
  visible: boolean
  /** La destacada de la portada: ocupa el puesto grande y lleva la cinta. */
  fijada: boolean
  updatedAt?: string
}

function aPublicacion(publicacion: PublicacionDeLaApi): Publicacion {
  return {
    id: String(publicacion.id),
    titulo: publicacion.titulo,
    descripcion: publicacion.descripcion ?? undefined,
    imagen: publicacion.imagenUrl ?? undefined,
    archivoUrl: publicacion.archivoUrl,
    fecha: publicacion.fecha,
    categoria: publicacion.categoria,
    fijada: publicacion.fijada,
  }
}

export async function publicacionesDePortada() {
  const publicaciones = await llamarApi<PublicacionDeLaApi[]>('/publications/latest')
  return publicaciones.map(aPublicacion)
}

export async function publicacionesPublicas(
  categoria: Publicacion['categoria'] | undefined,
  pagina: { pagina: number; porPagina: number },
): Promise<RespuestaPaginada<Publicacion>> {
  // `category` es la ruta que sirve el backend (`publicacion.routes.ts`): el
  // nombre de la variable se traduce, la dirección HTTP no.
  const ruta = categoria ? `/publications/category/${categoria}` : '/publications'
  const respuesta = await llamarApi<RespuestaPaginada<PublicacionDeLaApi>>(`${ruta}?${paramsPagina(pagina)}`)
  return { data: respuesta.data.map(aPublicacion), meta: respuesta.meta }
}

export type EstadoPublicacion = 'publicadas' | 'borradores' | 'incompletas'

/** Lo que acompaña al listado del CMS: cifras del tipo elegido y qué sale en la portada. */
export interface ResumenPublicaciones {
  publicadas: number
  borradores: number
  incompletas: number
  ultimaPublicacion: string | null
  /**
   * `ids`: las que la portada enseña ahora, en su orden; `limite`: cuántas
   * enseña (fijo); `fijada`: la destacada a mano, o null si va sola por fecha.
   */
  portada: { limite: number; ids: number[]; fijada: number | null }
}

export function publicacionesDelCms(
  pagina: { pagina: number; porPagina: number },
  filtros: { q?: string; estado?: EstadoPublicacion | ''; categoria?: Publicacion['categoria'] | '' } = {},
) {
  return llamarApi<RespuestaPaginada<PublicacionDeLaApi> & { resumen: ResumenPublicaciones }>(
    `/publications/admin?${paramsPagina(pagina, { q: filtros.q, estado: filtros.estado || undefined, categoria: filtros.categoria || undefined })}`,
  )
}

export interface DatosDePublicacion {
  titulo: string
  descripcion?: string
  imagenUrl?: string
  archivoUrl: string
  fecha?: string
  categoria: Publicacion['categoria']
  visible: boolean
  /** Solo al editar: se destaca una publicación ya publicada. */
  fijada?: boolean
}

export function crearPublicacion(payload: DatosDePublicacion) {
  return llamarApi<PublicacionDeLaApi>('/publications', { method: 'POST', json: payload })
}

export function actualizarPublicacion(id: number, payload: Partial<DatosDePublicacion>) {
  return llamarApi<PublicacionDeLaApi>(`/publications/${id}`, { method: 'PUT', json: payload })
}

export function eliminarPublicacion(id: number) {
  return llamarApi<{ message: string }>(`/publications/${id}`, { method: 'DELETE' })
}

/**
 * Como en noticias: se pide al servidor por id. Buscarla dentro del listado del
 * CMS dejaba sin editar cualquier publicación fuera de la página cargada.
 */
export function publicacionDelCms(id: number) {
  return llamarApi<PublicacionDeLaApi>(`/publications/${id}`)
}
