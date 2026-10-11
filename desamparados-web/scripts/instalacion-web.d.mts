// Los tipos de instalacion-web.mjs, para el plugin de Vite y las pruebas.
import type { DatosEntidad, Identidad, Marca } from '../../shared/datos-entidad.mjs'
import type { FicheroMarca, FicherosMarca } from '../../shared/marca.mjs'

/** Las URL de las imágenes de la marca que pinta la web, con `?v=` y ya con su respaldo. */
export interface ImagenesDeMarca {
  /** El escudo sobre fondo oscuro: barra, cajón, marcos y placas de las noticias. */
  escudo: string
  /** La papeleta; sin escudo destacado, el de sobre oscuro. */
  escudoDestacado: string
  /** La imagen al compartir y de los datos estructurados; sin compartir.jpg, el icono de 512. */
  compartir: string
}

export interface MarcaPublica extends Marca { imagenes: ImagenesDeMarca }

/** Lo que la web recibe en `window.__INSTALACION__` (src/instalacion.d.ts). */
export interface InstalacionPublica { identidad: Identidad; marca: MarcaPublica }

export declare function urlDeMarca(fichero: FicheroMarca): string
export declare function urlDeMarca(fichero: FicheroMarca | null | undefined): string | null
export declare function imagenesDeMarca(ficheros: FicherosMarca): ImagenesDeMarca
export declare function instalacionPublica(datos: Pick<DatosEntidad, 'identidad' | 'marca'>, ficheros: FicherosMarca): InstalacionPublica
export declare function rellenarIndex(plantilla: string, datos: Pick<DatosEntidad, 'identidad'>, ficheros: FicherosMarca): string
/** El problema de la plantilla, o null si carga bien /instalacion.js. */
export declare function comprobarPlantilla(plantilla: string): string | null
export declare function manifest(datos: Pick<DatosEntidad, 'identidad'>, ficheros: FicherosMarca): string
export declare function robots(datos: Pick<DatosEntidad, 'identidad'>): string
export declare function instalacionJs(datos: Pick<DatosEntidad, 'identidad' | 'marca'>, ficheros: FicherosMarca): string
/** La marca de `carpeta` (null: solo la de partida); lanza con los errores y pasa los avisos a `avisar`. */
export declare function leerMarcaDe(carpeta: string | null, avisar?: (aviso: string) => void): FicherosMarca
/** Vacía <destino>/marca/ y copia en ella, en 0644, los ficheros que se usan. Devuelve los copiados. */
export declare function copiarMarca(ficheros: FicherosMarca, destino: string): FicheroMarca[]
