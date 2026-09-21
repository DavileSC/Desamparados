/**
 * La destacada de la portada, en lo que Noticias y Publicaciones tienen igual.
 *
 * La portada se llena sola con lo más reciente publicado; `fijada` es la única
 * forma de intervenir: esa encabeza y las plazas que quedan se siguen
 * rellenando por fecha. Las reglas son tres, y las dos secciones las comparten:
 *
 *  - Una sola a la vez. No lo impone la base de datos (un índice único sobre un
 *    booleano no dejaría tener ninguna fijada): al fijar una se sueltan las
 *    demás en la misma transacción.
 *  - Solo se destaca lo publicado. Destacar un borrador no se vería en la web y
 *    dejaría al CMS diciendo que algo sale en la portada cuando no sale.
 *  - Al pasar a borrador se suelta. Si la marca se quedara puesta, la noticia
 *    volvería a la cabeza de la portada sola el día que se republicara, meses
 *    después y sin que nadie lo hubiera pedido.
 */
import { HttpError } from '../utils/error.handle.js';

/** Lo que el CMS pide cambiar de una noticia o publicación ya guardada. */
interface CambioPedido {
  fijada?: boolean;
  visible?: boolean;
}

interface MarcaAGuardar {
  /** Lo que se escribe en `fijada`; `undefined` es «no lo toques». */
  fijada: boolean | undefined;
  /** Si hay que soltar las demás antes de guardar esta. */
  soltarLasDemas: boolean;
}

/**
 * Resuelve las tres reglas de arriba para un guardado concreto.
 *
 * `guardada` es el estado en base de datos, que hace falta porque el formulario
 * del CMS puede mandar `fijada: true` sin mandar `visible`: entonces publicada
 * lo está o no lo está según lo que ya había.
 */
export function marcaDestacada(pedido: CambioPedido, guardada: { visible: boolean }): MarcaAGuardar {
  if (pedido.visible === false) return { fijada: false, soltarLasDemas: false };
  if (pedido.fijada !== true) return { fijada: pedido.fijada, soltarLasDemas: false };

  const quedaraPublicada = pedido.visible ?? guardada.visible;
  if (!quedaraPublicada) {
    throw new HttpError('Para destacarla en la portada tiene que estar publicada.');
  }
  return { fijada: true, soltarLasDemas: true };
}

/**
 * La fecha de la última publicación, sacada de las que salen en la portada.
 *
 * No vale con mirar la primera desde que hay destacada: puede ser una vieja que
 * se ha fijado a mano. El máximo sí vale, porque las plazas que la destacada no
 * ocupa se llenan por fecha, así que la más reciente de todas está siempre
 * entre ellas.
 */
export function fechaMasReciente(enPortada: { fecha: Date }[]): Date | null {
  return enPortada.reduce<Date | null>(
    (ultima, { fecha }) => (ultima === null || fecha > ultima ? fecha : ultima),
    null,
  );
}
