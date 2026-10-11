/**
 * Qué página se sirve y cuántos elementos caben. Vive suelto, sin base de
 * datos, porque antes estaba repetido en cuatro servicios con tres topes
 * distintos (50, 200 y 500) y nadie podía decir cuál regía dónde.
 */

interface Paginacion {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

interface MetaPaginacion {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RespuestaPaginada<T> {
  data: T[];
  meta: MetaPaginacion;
}

export const LIMITE_POR_DEFECTO = 20;

/**
 * Tope duro. El selector de la interfaz solo ofrece hasta 50; esto está para
 * que un `?limit=999999` escrito a mano no se lleve la tabla entera por
 * delante.
 */
export const LIMITE_MAXIMO = 100;

function aEntero(valor: unknown): number | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.floor(numero) : null;
}

export function sanearPaginacion(query: { page?: unknown; limit?: unknown }): Paginacion {
  const pagePedida = aEntero(query.page);
  const page = pagePedida !== null && pagePedida >= 1 ? pagePedida : 1;

  const limitPedido = aEntero(query.limit);
  const limit = limitPedido === null
    ? LIMITE_POR_DEFECTO
    : Math.min(Math.max(limitPedido, 1), LIMITE_MAXIMO);

  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

export function respuestaPaginada<T>(data: T[], total: number, { page, limit }: Paginacion): RespuestaPaginada<T> {
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
