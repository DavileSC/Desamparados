import type { Plugin } from 'vite'

export declare function datosDeLaInstalacion(): Plugin
export declare const CARPETA_IMAGENES: string
export declare function imagenDeLaInstalacion(ruta: string, carpeta?: string): { tipo: string; contenido: Buffer } | null
export declare const MAPA_DEL_BARRIO: string
export declare function mapaDelBarrio(fichero?: string): Buffer | null
/** backend-desamparados/storage/public: lo que publica la API local, como lo monta nginx. */
export declare const PUBLICADO_POR_LA_API: string
/** Un fichero que ha publicado la API (`instalacion/cabecera.html`, `marca/…`), o null. */
export declare function publicadoPorLaApi(relativa: string, carpeta?: string): Buffer | null
