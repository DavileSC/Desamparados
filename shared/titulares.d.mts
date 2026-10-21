// Tipos de titulares.mjs.

/** «A», «A y B», «A, B y C». */
export declare function unirTitulares(titulares: readonly string[]): string
/** `plural` con más de un titular. */
export declare function segunLosTitulares<T>(titulares: readonly string[], singular: T, plural: T): T
