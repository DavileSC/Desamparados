/**
 * Condición de búsqueda libre sobre varios campos de texto.
 *
 * Antes se buscaba el texto entero dentro de cada campo por separado, así que
 * «Juan» encontraba a Juan pero «Juan Pérez» no encontraba a nadie: el nombre
 * vive en `nombre` y el apellido en `apellidos`, y ningún campo contiene los
 * dos. Ahora el texto se parte en palabras y cada palabra tiene que aparecer
 * en alguno de los campos (en cualquiera, y en cualquier orden).
 */

/**
 * Tope de palabras que se tienen en cuenta. Cada una multiplica los `LIKE` de
 * la consulta; nadie escribe más de un nombre y dos apellidos, y un texto
 * pegado a mano con cien palabras no debería traducirse en cuatrocientos.
 */
export const MAX_PALABRAS_BUSQUEDA = 6;

export function palabrasDeBusqueda(texto: string | undefined): string[] {
  if (!texto) return [];
  return texto.trim().split(/\s+/).filter(Boolean).slice(0, MAX_PALABRAS_BUSQUEDA);
}

/**
 * Devuelve un `where` parcial para Prisma, o `{}` si no hay nada que buscar.
 * Se mezcla con el resto del filtro con `...`.
 */
export function condicionBusqueda<Campo extends string>(texto: string | undefined, campos: readonly Campo[]) {
  const palabras = palabrasDeBusqueda(texto);
  if (palabras.length === 0) return {};
  return {
    AND: palabras.map((palabra) => ({
      OR: campos.map((campo) => ({ [campo]: { contains: palabra } }) as { [K in Campo]: { contains: string } }),
    })),
  };
}
