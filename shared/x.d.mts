// Tipos de x.mjs.

export declare const LARGO_MAXIMO_X: number
export declare const LARGO_DE_UN_ENLACE: number
/** El texto que propone el CMS para una noticia: título y dirección. */
export declare function textoParaX(noticia: { titulo: string; direccion: string }): string
/** Lo que mide el texto contado como lo cuenta X. */
export declare function largoEnX(texto: string): number
/** Lo que X rechazaría del texto; null si vale. */
export declare function problemaDelTextoX(texto: string): string | null
