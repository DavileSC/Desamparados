// Tipos de marca.mjs, para importarlo desde TypeScript (la API en
// src/domain/marca.ts; la web, en sus guiones de Node y la configuración de
// Vite). En el navegador no se importa: la web recibe las URL ya resueltas en
// `window.__INSTALACION__.marca.imagenes`.
//
// Uso:
//   const { ficheros, errores, avisos } = resolverMarca({ carpeta: rutaDeMarca() })
//   // o, para fallar con un mensaje que lo dice todo y avisar por consola:
//   const ficheros = leerMarca()
//
// En las pruebas `rutaDeMarca()` da null (solo la marca de partida, sin
// avisos) aunque el .env defina `MARCA`; con
// `MARCA_DE_PRUEBA=shared/__fixtures__/marca/completa` se prueba una
// instalación con todos los ficheros (backend-desamparados/test/marca.test.ts
// dice qué hay en cada carpeta de fixtures).

export type ClaveMarca =
  | 'escudoSobreOscuro'
  | 'escudoSobreClaro'
  | 'escudoDestacado'
  | 'favicon32'
  | 'appleTouchIcon'
  | 'icono192'
  | 'icono512'
  | 'compartir'
  | 'correoCabecera'

/** Las claves que no tienen fichero de partida: salen a null si la instalación no las trae. */
export type ClaveSinPartida = 'escudoDestacado' | 'compartir' | 'correoCabecera'

export interface EntradaCatalogo {
  clave: ClaveMarca
  /** El nombre fijo del fichero en instalacion/marca/ (y en shared/marca-de-partida/). */
  fichero: string
  formato: 'png' | 'jpeg'
  /** Si la marca de partida trae uno. */
  partida: boolean
  /** Dónde se usa, para los avisos. */
  para: string
  /** Qué pasa si falta, en las que no tienen partida. */
  siFalta?: string
  /** Ancho×alto obligatorios (error si no). */
  exacto?: [number, number]
  altoMinimo?: number
  altoIdeal?: [number, number]
  anchoMinimo?: number
  proporcion?: [number, number]
  pesoAviso?: number
  transparencia?: 'si' | 'no'
}

export interface CabeceraImagen {
  formato: 'png' | 'jpeg'
  ancho: number
  alto: number
  /** PNG con canal alfa o con tRNS. Un JPEG nunca. */
  transparencia: boolean
  /** PNG Adam7 o JPEG progresivo. PDFKit 0.17 los lee bien: no es error. */
  entrelazado: boolean
  /** Solo en un JPEG con bytes tras el EOI (foto en movimiento, restos de un editor): cuántos. Sirve, con aviso. */
  datosTrasElFin?: number
}

export interface FicheroMarca {
  /** Ruta absoluta del fichero que se usa (de la instalación o de la partida). */
  ruta: string
  /** El nombre publicado, el del catálogo: la web lo sirve en /marca/<fichero>. */
  fichero: string
  origen: 'instalacion' | 'partida'
  /** Los 8 primeros del sha256 del contenido: para `?v=` en las URL. */
  version: string
  /** El Content-Type: 'image/png' o 'image/jpeg'. */
  tipo: string
  ancho: number
  alto: number
}

export type FicherosMarca =
  & { [C in Exclude<ClaveMarca, ClaveSinPartida>]: FicheroMarca }
  & { [C in ClaveSinPartida]: FicheroMarca | null }

export interface ResolucionMarca {
  ficheros: FicherosMarca
  /** No se puede arrancar: un fichero que está pero no sirve. */
  errores: string[]
  /** Se arranca: lo que falta (y se toma de la partida), medidas o pesos flojos, ficheros que no son de la marca. */
  avisos: string[]
}

export declare const RUTA_MARCA: 'instalacion/marca'
export declare const RUTA_PARTIDA: 'shared/marca-de-partida'
/** shared/marca-de-partida, absoluta. */
export declare const CARPETA_PARTIDA: string
/** 2 MB: por encima, error. */
export declare const PESO_MAXIMO: number
export declare const CATALOGO_MARCA: readonly Readonly<EntradaCatalogo>[]

/** Null si no es PNG ni JPEG; lanza si tiene la firma pero está cortada o rota. */
export declare function leerCabeceraImagen(buffer: Uint8Array): CabeceraImagen | null
/**
 * La carpeta de la marca, absoluta: `MARCA` (relativa a la raíz del
 * repositorio; lanza si no existe) o, si no, instalacion/marca aunque no
 * exista. En las pruebas `MARCA` no cuenta: null, o `MARCA_DE_PRUEBA` si la
 * fija la propia prueba.
 */
export declare function rutaDeMarca(entorno?: Readonly<Record<string, string | undefined>>): string | null
/** Una imagen suelta contra su entrada del catálogo (la que se sube desde el CMS). `cabecera` null: no sirve. */
export declare function comprobarImagenDeMarca(clave: ClaveMarca, bytes: Uint8Array): {
  cabecera: CabeceraImagen | null
  errores: string[]
  avisos: string[]
}
/** `carpeta` null: solo la partida, sin avisos. `partida`: por defecto CARPETA_PARTIDA. */
export declare function resolverMarca(opciones?: { carpeta?: string | null; partida?: string }): ResolucionMarca
/** `resolverMarca({ carpeta: rutaDeMarca(entorno) })`; lanza con todos los errores y avisa por consola. */
export declare function leerMarca(entorno?: Readonly<Record<string, string | undefined>>): FicherosMarca
