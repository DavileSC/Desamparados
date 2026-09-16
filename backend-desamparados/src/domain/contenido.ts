import defectos from '../../../shared/contenido-por-defecto.json' with { type: 'json' };

export const SLUGS_CONTENIDO = ['portada', 'recorrido', 'historia', 'titular'] as const;
export type SlugContenido = (typeof SLUGS_CONTENIDO)[number];

export const esSlugContenido = (valor: unknown): valor is SlugContenido =>
  typeof valor === 'string' && (SLUGS_CONTENIDO as readonly string[]).includes(valor);

/** Copia nueva de los textos de siempre. Nunca se devuelve el objeto original. */
export const porDefecto = (slug: SlugContenido): unknown =>
  structuredClone((defectos as Record<string, unknown>)[slug]);

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Mezcla lo guardado sobre los valores por defecto.
 *
 * Profunda en los objetos y **no** en las listas, y esto es de corrección:
 *
 * - Una lista guardada sustituye entera a la de por defecto. Si se mezclara
 *   elemento a elemento, borrar las nueve paradas del recorrido dejaría las
 *   nueve de por defecto de vuelta y el CMS parecería no guardar.
 * - Las teselas son la excepción, y por eso tienen su propia función: se casan
 *   por `clave`. Por posición, quitar una del documento correría todas las
 *   demás y cada tesela quedaría con el texto de otra.
 */
function mezclar(defecto: unknown, guardado: unknown): unknown {
  if (!esObjeto(defecto) || !esObjeto(guardado)) return defecto;

  const salida: Record<string, unknown> = { ...defecto };
  for (const [clave, valor] of Object.entries(guardado)) {
    if (!(clave in defecto)) continue; // Campos que el código no conoce: fuera.
    if (clave === 'teselas' && Array.isArray(defecto[clave]) && Array.isArray(valor)) {
      salida[clave] = mezclarTeselas(defecto[clave] as Record<string, unknown>[], valor);
    } else if (Array.isArray(defecto[clave])) {
      if (Array.isArray(valor)) salida[clave] = valor;
    } else if (esObjeto(defecto[clave])) {
      salida[clave] = mezclar(defecto[clave], valor);
    } else if (typeof valor === typeof defecto[clave]) {
      salida[clave] = valor;
    }
  }
  return salida;
}

/** El orden y el número de teselas los manda el código; el documento solo pone textos. */
function mezclarTeselas(defecto: Record<string, unknown>[], guardadas: unknown[]): unknown[] {
  const porClave = new Map(guardadas.filter(esObjeto).map((t) => [t.clave, t] as const));
  return defecto.map((tesela) => mezclar(tesela, porClave.get(tesela.clave) ?? {}));
}

export const mezclarConDefectos = (slug: SlugContenido, guardado: unknown): unknown =>
  mezclar(porDefecto(slug), guardado);
