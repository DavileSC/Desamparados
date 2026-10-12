import type { Plugin } from 'vite'

export declare function datosDeLaInstalacion(): Plugin
export declare const CARPETA_IMAGENES: string
export declare function imagenDeLaInstalacion(ruta: string, carpeta?: string): { tipo: string; contenido: Buffer } | null
export declare const MAPA_DEL_BARRIO: string
export declare function mapaDelBarrio(fichero?: string): Buffer | null
