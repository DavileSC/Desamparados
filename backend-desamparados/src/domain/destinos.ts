import destinos from '../../../shared/destinos-de-enlace.json' with { type: 'json' };
import paginas from '../../../shared/paginas-publicas.json' with { type: 'json' };

/**
 * Las rutas fijas a las que puede llevar un enlace escrito en el CMS: las
 * páginas por bloques y las demás que declara `shared/destinos-de-enlace.json`.
 */
export const RUTAS_DESTINO: ReadonlySet<string> = new Set([
  ...paginas.paginas.map((p) => p.ruta),
  ...destinos.otros.map((d) => d.ruta),
]);

/** Una noticia concreta: el prefijo y un slug como los que genera el servidor. */
const NOTICIA = new RegExp(`^${destinos.prefijoNoticia.replace(/\//g, '\\/')}[a-z0-9]+(?:-[a-z0-9]+)*$`);

/**
 * `true` si el enlace lleva a una página que existe en la web.
 *
 * Antes bastaba con que empezara por una barra: «/corporacion/hola» se
 * guardaba y la tarjeta llevaba a «página no encontrada». Ahora solo valen las
 * rutas de la lista y las de las noticias. De paso cierra lo que ya cerraba el
 * patrón anterior: nada de `//otro.test` ni de `javascript:`.
 */
export function esDestinoValido(enlace: string): boolean {
  return RUTAS_DESTINO.has(enlace) || NOTICIA.test(enlace);
}
