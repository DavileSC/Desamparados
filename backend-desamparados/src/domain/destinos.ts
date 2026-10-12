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

/**
 * Las que cambiaron de dirección (`antiguas`): la web las redirige a la
 * nueva, y los enlaces guardados con ellas (en la base del VPS) tienen que
 * seguir pasando al volver a guardar su página. No son destinos que ofrecer.
 */
const RUTAS_ANTIGUAS: ReadonlySet<string> = new Set(destinos.antiguas.map((d) => d.ruta));

/** Una noticia concreta: el prefijo y un slug como los que genera el servidor. */
const NOTICIA = new RegExp(`^${destinos.prefijoNoticia.replace(/\//g, '\\/')}[a-z0-9]+(?:-[a-z0-9]+)*$`);

/**
 * El ancla de un bloque (`presentacion.ancla`): minúsculas, cifras y guiones,
 * como un slug. Es lo que va detrás de la almohadilla en `/historia#fundacion`.
 */
export const ANCLA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `true` si el enlace lleva a una página que existe en la web.
 *
 * Puede llevar un ancla detrás (`/historia#fundacion`), que baja hasta el
 * bloque que la tenga. Del ancla solo se comprueba la forma: que un bloque de
 * esa página la lleve de verdad es cosa de quien edita, y si no, la página se
 * abre por arriba, que no es ningún error.
 *
 * Antes bastaba con que empezara por una barra: «/hola» se
 * guardaba y la tarjeta llevaba a «página no encontrada». Ahora solo valen las
 * rutas de la lista y las de las noticias. De paso cierra lo que ya cerraba el
 * patrón anterior: nada de `//otro.test` ni de `javascript:`.
 */
export function esDestinoValido(enlace: string): boolean {
  const almohadilla = enlace.indexOf('#');
  const ruta = almohadilla === -1 ? enlace : enlace.slice(0, almohadilla);
  if (almohadilla !== -1 && !ANCLA.test(enlace.slice(almohadilla + 1))) return false;
  return RUTAS_DESTINO.has(ruta) || RUTAS_ANTIGUAS.has(ruta) || NOTICIA.test(ruta);
}
