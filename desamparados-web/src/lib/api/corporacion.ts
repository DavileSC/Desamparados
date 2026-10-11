import type { QueryClient } from '@tanstack/react-query'
import type { Red, Secretaria, Sede } from '../../../../shared/datos-entidad.mjs'
import { llamarApi } from './cliente'

/**
 * Cómo se contacta con la corporación: Secretaría, la sede, las redes y el
 * correo de los derechos del RGPD. Viven en la base y se cambian en Sistema →
 * «Datos de la corporación»; la primera vez salen del fichero de la
 * instalación. Lo que no cambia (nombre, tipo, dominio) sigue en `config/site.ts`.
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
