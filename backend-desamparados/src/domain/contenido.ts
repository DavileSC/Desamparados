import defectos from '../../../shared/contenido-por-defecto.json' with { type: 'json' };
import catalogo from '../../../shared/paginas-publicas.json' with { type: 'json' };
import { esClaveEncendible, type ClaveEncendible } from './modulos.js';

/**
 * Las páginas con documento editable: primero la portada, que tiene
 * formulario propio, y después las que se componen por bloques, que son las
 * que declara `shared/paginas-publicas.json`.
 *
 * La lista va escrita a mano y no derivada de ese JSON porque TypeScript no
 * saca tipos literales de un import de JSON: derivarla dejaría `SlugContenido`
 * en `string` y con él el mapa de esquemas y `porDefecto` sin comprobación.
 * De que las dos listas no se separen se encarga `paginas-catalogo.test.ts`.
 */
export const SLUGS_CONTENIDO = ['portada', 'recorrido', 'historia', 'parroquia', 'organos-de-gobierno', 'nuestros-fines', 'caridad', 'formacion', 'cultos', 'sabado-de-pasion', 'trono', 'enseres', 'rosario', 'desamparados', 'ajuar', 'agenda', 'noticias', 'publicaciones', 'boletines', 'dossier-prensa', 'contacto'] as const;
export type SlugContenido = (typeof SLUGS_CONTENIDO)[number];

export const esSlugContenido = (valor: unknown): valor is SlugContenido =>
  typeof valor === 'string' && (SLUGS_CONTENIDO as readonly string[]).includes(valor);

/**
 * El módulo del que depende cada página que lo dice (`modulo` en
 * `shared/paginas-publicas.json`); las que no, son del núcleo. Una clave que
 * no sea de ningún módulo para el arranque: si no, la página quedaría siempre
 * apagada sin que nadie supiera por qué.
 */
const MODULO_DE_PAGINA: ReadonlyMap<string, ClaveEncendible> = new Map(
  (catalogo.paginas as { slug: string; modulo?: string }[]).flatMap(({ slug, modulo }) => {
    if (modulo === undefined) return [];
    if (!esClaveEncendible(modulo)) throw new Error(`shared/paginas-publicas.json: «${slug}» depende de «${modulo}», que no es ningún módulo`);
    return [[slug, modulo] as const];
  }),
);

/** De qué módulo es la página, o `undefined` si es del núcleo. */
export const moduloDePagina = (slug: SlugContenido): ClaveEncendible | undefined => MODULO_DE_PAGINA.get(slug);

/**
 * Claves que el contenido de partida tuvo y ya no tiene, como `página.ruta`.
 * Lo guardado con ellas se depura solo al leer (`mezclarConDefectos` tira lo
 * que no conoce); esta lista es para la semilla de una instalación, que con
 * una clave desconocida no arranca (`contenido-inicial.ts`): una semilla
 * escrita antes de retirarla no tiene por qué dejar la API parada.
 */
export const CLAVES_RETIRADAS: ReadonlySet<string> = new Set([
  // El aviso de retransmisión de la portada (WP12, 13-10-2026): nunca llegó a pintarse.
  'portada.agenda.directoTitulo',
  'portada.agenda.directoTexto',
]);

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
