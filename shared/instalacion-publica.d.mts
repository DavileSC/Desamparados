// Tipos de instalacion-publica.mjs, para la API (services/marca.service.ts), el
// plugin de Vite y las pruebas.
import type { DatosEntidad, Identidad, Marca } from './datos-entidad.mjs'
import type { FicheroMarca, FicherosMarca } from './marca.mjs'

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

type Datos = Pick<DatosEntidad, 'identidad' | 'marca'>

export declare const PLANTILLA_CABECERA: string
export declare const INCLUSION_CABECERA: '<!--# include virtual="/_cabecera" -->'

export declare function urlDeMarca(fichero: FicheroMarca): string
export declare function urlDeMarca(fichero: FicheroMarca | null | undefined): string | null
export declare function imagenesDeMarca(ficheros: FicherosMarca): ImagenesDeMarca
export declare function instalacionPublica(datos: Datos, ficheros: FicherosMarca): InstalacionPublica
export declare function rellenarIndex(plantilla: string, datos: Pick<DatosEntidad, 'identidad'>, ficheros: FicherosMarca): string
/** La cabecera de index.html, con shared/cabecera.plantilla.html. */
export declare function cabeceraHtml(datos: Pick<DatosEntidad, 'identidad'>, ficheros: FicherosMarca): string
export declare function manifest(datos: Pick<DatosEntidad, 'identidad'>, ficheros: FicherosMarca): string
export declare function instalacionJs(datos: Datos, ficheros: FicherosMarca): string
/** La marca de `carpeta` (null: solo la de partida); lanza con los errores y pasa los avisos a `avisar`. */
export declare function leerMarcaDe(carpeta: string | null, avisar?: (aviso: string) => void): FicherosMarca
/** Deja en <destino>/marca/, en 0644, los ficheros que se usan y borra los demás. Devuelve los copiados. */
export declare function copiarMarca(ficheros: FicherosMarca, destino: string): FicheroMarca[]
/** instalacion/{instalacion.js, manifest.json, cabecera.html} y marca/ en <destino>. */
export declare function publicarInstalacion(destino: string, datos: Datos, ficheros: FicherosMarca): void
