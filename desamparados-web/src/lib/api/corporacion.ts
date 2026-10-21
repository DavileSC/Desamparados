import type { QueryClient } from '@tanstack/react-query'
import type { Identidad, Marca, Red, Secretaria, Sede } from '../../../../shared/datos-entidad.mjs'
import { llamarApi } from './cliente'

/**
 * Cómo se contacta con la corporación: Secretaría, la sede, las redes y el
 * correo de los derechos del RGPD. Viven en la base y se cambian en Sistema →
 * «Datos de la corporación»; la primera vez salen del fichero de la
 * instalación. La identidad y la marca, más abajo.
 */
export interface DatosDeContacto {
  secretaria: Secretaria
  sede: Sede
  redes: Record<Red, string | null>
  privacidad: { emailDerechos: string | null }
}

export const CLAVE_CORPORACION = ['corporacion'] as const

/** Sin sesión: el pie, los textos legales y el alta los enseñan a cualquiera. */
export const datosDeContacto = () => llamarApi<DatosDeContacto>('/corporacion', { auth: false })
export const datosDeContactoDelCms = () => llamarApi<DatosDeContacto>('/cms/corporacion')
export const guardarDatosDeContacto = (datos: DatosDeContacto) => llamarApi<DatosDeContacto>('/cms/corporacion', { method: 'PUT', json: datos })

/** Tras guardar en el CMS: que el pie y los textos legales enseñen ya lo nuevo. */
export function ponerDatosDeContacto(queryClient: QueryClient, datos: DatosDeContacto) {
  queryClient.setQueryData(CLAVE_CORPORACION, datos)
}

/** Las imágenes que se suben desde el CMS: los iconos salen del escudo sobre oscuro. */
export type ClaveDeImagen = 'escudoSobreOscuro' | 'escudoSobreClaro' | 'escudoDestacado' | 'compartir' | 'correoCabecera'

/** Una imagen de la marca: la URL lleva su versión (`?v=`). `propia` es false con la de partida. */
export interface ImagenDeLaMarca {
  url: string
  propia: boolean
  ancho: number
  alto: number
  tipo: string
}

/** La identidad sin el dominio: lo que se cambia desde el CMS. Sin `titular`, que sale de `titulares`. */
export type IdentidadEditable = Omit<Identidad, 'dominio' | 'titular'>

/**
 * Sistema → Datos de la corporación → «Identidad y marca», solo
 * Administración. La web la lee al cargar la página (`window.__INSTALACION__`),
 * así que lo guardado se ve en la siguiente que se abra, no en la que ya está
 * abierta.
 */
export interface EstadoDeLaMarca {
  identidad: IdentidadEditable
  colores: Marca
  /** El de la instalación: no se cambia desde aquí. */
  dominio: string
  imagenes: Record<ClaveDeImagen, ImagenDeLaMarca | null>
  iconos: { favicon32: string; appleTouchIcon: string; icono192: string; icono512: string }
  /** Contraste de los colores, medidas o pesos flojos. No impiden guardar. */
  avisos: string[]
}

export const marcaDelCms = () => llamarApi<EstadoDeLaMarca>('/cms/corporacion/marca')
export const guardarIdentidad = (datos: { identidad: IdentidadEditable; colores: Marca }) =>
  llamarApi<EstadoDeLaMarca>('/cms/corporacion/identidad', { method: 'PUT', json: datos })

export function subirImagenDeMarca(clave: ClaveDeImagen, fichero: File) {
  const formulario = new FormData()
  formulario.append('imagen', fichero)
  return llamarApi<EstadoDeLaMarca>(`/cms/corporacion/marca/${clave}`, { method: 'PUT', formData: formulario })
}

export const quitarImagenDeMarca = (clave: ClaveDeImagen) =>
  llamarApi<EstadoDeLaMarca>(`/cms/corporacion/marca/${clave}`, { method: 'DELETE' })

/** Los pasos del asistente de primer arranque que se pueden saltar (el nombre no). */
export type PasoSaltable = 'escudo' | 'colores' | 'contacto' | 'legales' | 'secciones'

/** Por dónde va el asistente: lo apunta la API para retomarlo donde se dejó. */
export interface EstadoDelAsistente {
  /** De 0 (el nombre) a 6 (Listo). */
  paso: number
  saltados: PasoSaltable[]
  /** Cuándo se terminó; null mientras quede algo. */
  terminado: string | null
}

export const CLAVE_ASISTENTE = ['cms', 'corporacion', 'asistente'] as const
export const asistenteDelCms = () => llamarApi<EstadoDelAsistente>('/cms/corporacion/asistente')
export const guardarAsistente = (datos: { paso: number; saltados: PasoSaltable[]; terminar: boolean }) =>
  llamarApi<EstadoDelAsistente>('/cms/corporacion/asistente', { method: 'PUT', json: datos })
