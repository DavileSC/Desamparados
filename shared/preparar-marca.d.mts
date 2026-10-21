// Tipos de preparar-marca.mjs. `sharp` llega de quien llama (la API, o el guion
// de la web que lo toma prestado del backend): aquí va sin tipo para no
// depender de sus definiciones.
import type { ClaveMarca } from './marca.mjs'

type Sharp = unknown

export type ClaveQueSeSube = 'escudoSobreOscuro' | 'escudoSobreClaro' | 'escudoDestacado' | 'compartir' | 'correoCabecera'
export type ClaveDeIcono = 'favicon32' | 'appleTouchIcon' | 'icono192' | 'icono512'

export declare const TINTA: { r: number; g: number; b: number; alpha: number }
export declare const PROPORCION: number
export declare const ICONOS: readonly { clave: ClaveDeIcono & ClaveMarca; fichero: string; lado: number }[]
export declare const ALTO_WEB: { minimo: number; maximo: number }
export declare const CLAVES_QUE_SE_SUBEN: readonly ClaveQueSeSube[]

export declare function prepararImagenDeMarca(sharp: Sharp, clave: ClaveQueSeSube, bytes: Uint8Array): Promise<Buffer>
export declare function iconosDeMarca(
  sharp: Sharp,
  escudoAlLado: (alto: number) => Promise<Buffer>,
): Promise<{ clave: ClaveDeIcono; fichero: string; lado: number; bytes: Buffer }[]>
export declare function escudoQueCabe(sharp: Sharp, escudo: Uint8Array | string): (lado: number) => Promise<Buffer>
