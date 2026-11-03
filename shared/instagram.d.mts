// Tipos de instagram.mjs.

export declare const LARGO_MAXIMO_PIE: number
export declare const ETIQUETAS_MAXIMAS: number
export declare const MENCIONES_MAXIMAS: number
export declare const PROPORCION_MINIMA: number
export declare const PROPORCION_MAXIMA: number
/** El pie que propone el CMS para una noticia. */
export declare function pieDeInstagram(noticia: { titulo: string; extracto: string | null | undefined }): string
/** Lo que Instagram rechazaría del pie; null si vale. */
export declare function problemaDelPie(pie: string): string | null
