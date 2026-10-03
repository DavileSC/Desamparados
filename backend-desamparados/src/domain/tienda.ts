/**
 * La tienda: lo que se puede pedir y cuánto cuesta. El total lo calcula el
 * servidor con los precios de la base; del navegador solo llega qué y cuánto.
 */

export const MAX_POR_LINEA = 20;
export const MAX_LINEAS = 30;

export interface TallaALaVenta {
  id: number;
  nombre: string;
  /** Null: sin límite. */
  existencias: number | null;
}

export interface ProductoALaVenta {
  id: number;
  nombre: string;
  /** En céntimos. */
  centimos: number;
  activo: boolean;
  /** Null: sin límite. Con tallas no cuenta: cuenta lo de cada talla. */
  existencias: number | null;
  /** Vacío o sin poner: el producto no tiene tallas. */
  tallas?: TallaALaVenta[];
}

export interface LineaPedida { productoId: number; tallaId?: number; cantidad: number }
export interface LineaDelPedido { productoId: number; tallaId: number | null; talla: string | null; nombre: string; centimos: number; cantidad: number }

/** Cómo se nombra lo pedido en los avisos: con su talla, si la tiene. */
export const nombreConTalla = (nombre: string, talla: string | null) => (talla ? `${nombre} (talla ${talla})` : nombre);

/**
 * La talla de una línea, o por qué no vale. Un producto con tallas se pide
 * siempre por talla, y una suya; uno sin tallas, sin ninguna. Devuelve lo
 * que queda de lo pedido: de la talla o del producto.
 */
export function tallaDeLaLinea(p: ProductoALaVenta, tallaId: number | undefined):
  { talla: TallaALaVenta | null; existencias: number | null } | { problema: string } {
  const tallas = p.tallas ?? [];
  if (tallas.length === 0) {
    if (tallaId !== undefined) return { problema: `«${p.nombre}» ya no tiene tallas. Recarga la página.` };
    return { talla: null, existencias: p.existencias };
  }
  if (tallaId === undefined) return { problema: `De «${p.nombre}» hay que elegir la talla.` };
  const talla = tallas.find((t) => t.id === tallaId);
  if (!talla) return { problema: `Esa talla de «${p.nombre}» ya no está. Recarga la página.` };
  return { talla, existencias: talla.existencias };
}

/** «Se ha agotado» o «solo quedan n», con la talla si la hay; null si hay de sobra. */
export function faltaDe(p: ProductoALaVenta, talla: TallaALaVenta | null, existencias: number | null, cantidad: number, agotado = 'se ha agotado') {
  if (existencias === null || existencias >= cantidad) return null;
  const nombre = nombreConTalla(p.nombre, talla?.nombre ?? null);
  return existencias === 0 ? `«${nombre}» ${agotado}.` : `De «${nombre}» solo quedan ${existencias}.`;
}

/** La clave con que se juntan las líneas iguales: el producto y su talla. */
const clave = (productoId: number, tallaId: number | undefined) => `${productoId}:${tallaId ?? ''}`;

/**
 * Comprueba lo pedido contra el catálogo y devuelve las líneas con su precio
 * y el total, o por qué no se puede pedir. La misma línea (producto y talla)
 * dos veces se junta.
 */
export function prepararPedido(pedidas: LineaPedida[], catalogo: ProductoALaVenta[]):
  { lineas: LineaDelPedido[]; centimos: number } | { problema: string } {
  if (pedidas.length === 0) return { problema: 'La cesta está vacía.' };
  const juntas = new Map<string, LineaPedida>();
  for (const l of pedidas) {
    const k = clave(l.productoId, l.tallaId);
    juntas.set(k, { ...l, cantidad: (juntas.get(k)?.cantidad ?? 0) + l.cantidad });
  }
  if (juntas.size > MAX_LINEAS) return { problema: `Como mucho ${MAX_LINEAS} productos distintos por pedido.` };
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const lineas: LineaDelPedido[] = [];
  for (const { productoId, tallaId, cantidad } of juntas.values()) {
    const p = porId.get(productoId);
    if (!p || !p.activo) return { problema: 'Algún producto de la cesta ya no está a la venta. Recarga la tienda.' };
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_LINEA) return { problema: `De «${p.nombre}» se pueden pedir entre 1 y ${MAX_POR_LINEA}.` };
    const t = tallaDeLaLinea(p, tallaId);
    if ('problema' in t) return t;
    const falta = faltaDe(p, t.talla, t.existencias, cantidad);
    if (falta) return { problema: falta };
    lineas.push({ productoId, tallaId: t.talla?.id ?? null, talla: t.talla?.nombre ?? null, nombre: p.nombre, centimos: p.centimos, cantidad });
  }
  return { lineas, centimos: lineas.reduce((s, l) => s + l.centimos * l.cantidad, 0) };
}
