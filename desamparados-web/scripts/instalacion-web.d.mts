// Los tipos de instalacion-web.mjs, para el plugin de Vite y las pruebas.
import type { DatosEntidad, Identidad, Marca } from '../../shared/datos-entidad.mjs'

/** Lo que la web recibe en `window.__INSTALACION__` (src/instalacion.d.ts). */
export interface InstalacionPublica { identidad: Identidad; marca: Marca }

export declare function instalacionPublica(datos: Pick<DatosEntidad, 'identidad' | 'marca'>): InstalacionPublica
export declare function rellenarIndex(plantilla: string, datos: Pick<DatosEntidad, 'identidad'>): string
/** El problema de la plantilla, o null si carga bien /instalacion.js. */
export declare function comprobarPlantilla(plantilla: string): string | null
export declare function manifest(datos: Pick<DatosEntidad, 'identidad'>): string
export declare function robots(datos: Pick<DatosEntidad, 'identidad'>): string
export declare function instalacionJs(datos: Pick<DatosEntidad, 'identidad' | 'marca'>): string
