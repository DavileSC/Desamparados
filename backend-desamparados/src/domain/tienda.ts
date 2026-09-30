/**
 * La tienda: lo que se puede pedir y cuánto cuesta. El total lo calcula el
 * servidor con los precios de la base; del navegador solo llega qué y cuánto.
 */

export const MAX_POR_LINEA = 20;
export const MAX_LINEAS = 30;

export interface ProductoALaVenta {
  id: number;
  nombre: string;
  /** En céntimos. */
  centimos: number;
  activo: boolean;
  /** Null: sin límite. */
  existencias: number | null;
}

export interface LineaPedida { productoId: number; cantidad: number }
export interface LineaDelPedido { productoId: number; nombre: string; centimos: number; cantidad: number }

/**
 * Comprueba lo pedido contra el catálogo y devuelve las líneas con su precio
 * y el total, o por qué no se puede pedir. La misma línea dos veces se junta.
 */
export function prepararPedido(pedidas: LineaPedida[], catalogo: ProductoALaVenta[]):
  { lineas: LineaDelPedido[]; centimos: number } | { problema: string } {
  if (pedidas.length === 0) return { problema: 'La cesta está vacía.' };
  const juntas = new Map<number, number>();
  for (const l of pedidas) juntas.set(l.productoId, (juntas.get(l.productoId) ?? 0) + l.cantidad);
  if (juntas.size > MAX_LINEAS) return { problema: `Como mucho ${MAX_LINEAS} productos distintos por pedido.` };
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const lineas: LineaDelPedido[] = [];
  for (const [productoId, cantidad] of juntas) {
    const p = porId.get(productoId);
    if (!p || !p.activo) return { problema: 'Algún producto de la cesta ya no está a la venta. Recarga la tienda.' };
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_LINEA) return { problema: `De «${p.nombre}» se pueden pedir entre 1 y ${MAX_POR_LINEA}.` };
    if (p.existencias !== null && p.existencias < cantidad) {
      return { problema: p.existencias === 0 ? `«${p.nombre}» se ha agotado.` : `De «${p.nombre}» solo quedan ${p.existencias}.` };
    }
    lineas.push({ productoId, nombre: p.nombre, centimos: p.centimos, cantidad });
  }
  return { lineas, centimos: lineas.reduce((s, l) => s + l.centimos * l.cantidad, 0) };
}
