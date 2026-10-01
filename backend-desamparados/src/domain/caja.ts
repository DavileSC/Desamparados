/**
 * La caja de la tienda sin base de datos: qué se cobra en una venta y qué
 * debe haber en el cajón al cerrar.
 *
 * Una venta lleva productos del catálogo (el precio sale de la base, nunca
 * del navegador) o cosas sueltas escritas a mano (un libro de segunda mano,
 * una estampa que no está en la tienda), con su precio.
 */
import { MAX_POR_LINEA, type ProductoALaVenta } from './tienda.js';

export const MAX_LINEAS_CAJA = 40;
/** Lo más caro que se apunta suelto: más, es que se ha escrito mal. */
export const MAX_SUELTO_CENTIMOS = 5_000_00;

export type LineaDeCaja =
  | { productoId: number; cantidad: number }
  | { nombre: string; centimos: number; cantidad: number };

export interface LineaCobrada { productoId: number | null; nombre: string; centimos: number; cantidad: number }

export function prepararVenta(lineas: LineaDeCaja[], catalogo: ProductoALaVenta[]):
  { lineas: LineaCobrada[]; centimos: number } | { problema: string } {
  if (lineas.length === 0) return { problema: 'La venta está vacía.' };
  if (lineas.length > MAX_LINEAS_CAJA) return { problema: `Como mucho ${MAX_LINEAS_CAJA} líneas por venta.` };
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  // El mismo producto dos veces se junta, para comprobar bien lo que queda.
  const juntas = new Map<number, number>();
  const cobradas: LineaCobrada[] = [];
  for (const l of lineas) {
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > MAX_POR_LINEA) return { problema: `Cada línea lleva entre 1 y ${MAX_POR_LINEA} unidades.` };
    if ('productoId' in l) {
      juntas.set(l.productoId, (juntas.get(l.productoId) ?? 0) + l.cantidad);
    } else {
      const nombre = l.nombre.trim();
      if (!nombre) return { problema: 'Lo que se vende suelto necesita un nombre.' };
      if (!Number.isInteger(l.centimos) || l.centimos <= 0 || l.centimos > MAX_SUELTO_CENTIMOS) return { problema: `«${nombre}»: el precio no es válido.` };
      cobradas.push({ productoId: null, nombre, centimos: l.centimos, cantidad: l.cantidad });
    }
  }
  for (const [productoId, cantidad] of juntas) {
    const p = porId.get(productoId);
    // En la caja se vende también lo retirado de la web: está en el mostrador.
    if (!p) return { problema: 'Algún producto ya no existe. Recarga la caja.' };
    if (p.existencias !== null && p.existencias < cantidad) {
      return { problema: p.existencias === 0 ? `«${p.nombre}» está agotado.` : `De «${p.nombre}» solo quedan ${p.existencias}.` };
    }
    cobradas.unshift({ productoId, nombre: p.nombre, centimos: p.centimos, cantidad });
  }
  return { lineas: cobradas, centimos: cobradas.reduce((s, l) => s + l.centimos * l.cantidad, 0) };
}

export type MetodoDeCaja = 'EFECTIVO' | 'TARJETA' | 'BIZUM';

export interface ResumenDeCaja {
  ventas: number;
  anuladas: number;
  /** En céntimos, sin las anuladas. */
  total: number;
  porMetodo: Record<MetodoDeCaja, number>;
  /** El fondo más lo cobrado en efectivo: lo que tiene que haber en el cajón. */
  efectivoEsperado: number;
}

export function resumenDeCaja(fondoCentimos: number, ventas: { metodo: string; centimos: number; anulada: boolean }[]): ResumenDeCaja {
  const porMetodo: Record<MetodoDeCaja, number> = { EFECTIVO: 0, TARJETA: 0, BIZUM: 0 };
  let total = 0;
  let anuladas = 0;
  for (const v of ventas) {
    if (v.anulada) { anuladas += 1; continue; }
    total += v.centimos;
    if (v.metodo in porMetodo) porMetodo[v.metodo as MetodoDeCaja] += v.centimos;
  }
  return { ventas: ventas.length - anuladas, anuladas, total, porMetodo, efectivoEsperado: fondoCentimos + porMetodo.EFECTIVO };
}
