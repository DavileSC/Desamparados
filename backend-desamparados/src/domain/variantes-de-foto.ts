/**
 * Las copias reducidas que acompañan a cada foto pública subida desde el CMS,
 * para que la web las ofrezca en `srcset` y un móvil no baje la de 1920 px
 * para pintarla a 400.
 *
 * Contrato con la web: si una foto está en `/storage/public/<hex>.webp` (32
 * hex), existen SIEMPRE `/storage/public/<hex>-640.webp` y `<hex>-1280.webp`,
 * también cuando la foto es más estrecha (entonces son una copia de la
 * principal). Así la web deduce sus direcciones de la URL guardada, sin
 * preguntar a la API ni conocer el ancho real: unos KB de disco a cambio de no
 * guardar ni consultar ningún dato más. Las fotos subidas antes de esto las
 * genera `npm run imagenes:variantes`.
 */
export const ANCHOS_VARIANTES = [640, 1280] as const;

/** `<hex>.webp` → `<hex>-640.webp`. */
export const nombreDeVariante = (nombre: string, ancho: number) =>
  `${nombre.replace(/\.[^.]+$/, '')}-${ancho}.webp`;

/** El nombre de una copia reducida: la foto de la que sale va en el grupo 1 (sin extensión). */
export const NOMBRE_DE_VARIANTE = new RegExp(`^([a-f0-9]{32})-(?:${ANCHOS_VARIANTES.join('|')})\\.webp$`, 'i');

/** Si el nombre es una copia reducida, el de su foto (`<hex>.webp`); si no, null. */
export function fotoDeVariante(nombre: string): string | null {
  const coincidencia = NOMBRE_DE_VARIANTE.exec(nombre);
  return coincidencia ? `${coincidencia[1]}.webp` : null;
}
