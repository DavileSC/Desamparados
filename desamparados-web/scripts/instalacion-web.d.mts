// Los tipos de instalacion-web.mjs, para el plugin de Vite y las pruebas. Lo
// que compone los ficheros de la web vive en shared/instalacion-publica.mjs y
// se reexporta desde aquí.
import type { DatosEntidad } from '../../shared/datos-entidad.mjs'

export type { ImagenesDeMarca, InstalacionPublica, MarcaPublica } from '../../shared/instalacion-publica.mjs'
export {
  cabeceraHtml, copiarMarca, imagenesDeMarca, instalacionJs, instalacionPublica, leerMarcaDe, manifest, rellenarIndex, urlDeMarca,
} from '../../shared/instalacion-publica.mjs'

/** El problema de index.html, o null si carga bien /instalacion.js y lleva el sitio de la cabecera. */
export declare function comprobarPlantilla(plantilla: string): string | null
export declare function robots(datos: Pick<DatosEntidad, 'identidad'>): string
