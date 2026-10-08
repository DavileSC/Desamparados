// Los tipos de rutas-publicas.mjs para la prueba en TypeScript que lo importa.
export interface RutaPublica { ruta: string; requisito: string[] }
export function rutasDelBloquePublico(): RutaPublica[]
export function urlsIndexables(activos?: readonly string[]): string[]
export function rutasParaElSitemap(): RutaPublica[]
