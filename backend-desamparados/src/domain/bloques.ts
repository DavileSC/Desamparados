import catalogo from '../../../shared/tipos-de-bloque.json' with { type: 'json' };

/**
 * Los tipos de bloque que puede tener una página de la web pública.
 *
 * La lista vive en `shared/tipos-de-bloque.json` y la leen también la web y el
 * CMS: con dos listas, añadir un bloque en un lado y olvidarlo en el otro daría
 * un 400 al guardar sin ningún aviso previo.
 */
export const TIPOS_BLOQUE = catalogo.tipos as readonly string[];

export type TipoBloque = (typeof catalogo.tipos)[number];

export const esTipoBloque = (valor: unknown): valor is TipoBloque =>
  typeof valor === 'string' && TIPOS_BLOQUE.includes(valor);
