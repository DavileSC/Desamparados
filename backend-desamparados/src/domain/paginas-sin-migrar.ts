/**
 * Qué páginas siguen guardadas con la forma anterior a los bloques.
 *
 * Lo usan dos sitios que tienen que decir lo mismo: el script
 * `scripts/migrar-a-bloques.ts`, que las convierte, y el arranque de la API,
 * que avisa si queda alguna. La lista vive aquí para que añadir una a un lado
 * y olvidarla en el otro no compile.
 */
import db from '../config/db.js';

/**
 * Las páginas que existieron antes de que toda la web pública pasara a
 * bloques, cada una con su forma propia en `ContenidoPagina`. La de la Titular
 * también lo era, pero su página se quitó (25-09-2026) y la migración
 * `sin_portadas_de_seccion` borra su fila.
 */
export const PAGINAS_ANTERIORES_A_BLOQUES = ['recorrido', 'historia'] as const;

export type PaginaAnteriorABloques = (typeof PAGINAS_ANTERIORES_A_BLOQUES)[number];

/**
 * Las que aún no se han convertido, por su slug.
 *
 * Se reconoce por lo mismo que mira el script: un documento en la forma nueva
 * tiene `bloques` y es una lista. Una fila que no existe no cuenta: la siembra
 * la creará ya en la forma nueva.
 */
export async function paginasSinMigrarABloques(): Promise<string[]> {
  const filas = await db.contenidoPagina.findMany({
    where: { slug: { in: [...PAGINAS_ANTERIORES_A_BLOQUES] } },
    select: { slug: true, datos: true },
  });
  return filas
    .filter((fila) => !Array.isArray((fila.datos as { bloques?: unknown } | null)?.bloques))
    .map((fila) => fila.slug);
}
