export interface Recuento {
  etiqueta: string;
  total: number;
}

/** Minúsculas, sin espacios sobrantes ni dobles: dos formas de escribir lo mismo caen juntas. */
function normalizar(valor: string): string {
  return valor.trim().toLowerCase().replace(/\s+/g, ' ');
}

function capitalizar(valor: string): string {
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

/**
 * Cuenta valores de un campo de texto libre, uniendo las variantes de escritura.
 * Devuelve los `top` mayores y mete el resto en «Otros».
 */
export function agruparPorTextoLibre(
  valores: (string | null | undefined)[],
  top = 5,
): Recuento[] {
  const cuenta = new Map<string, number>();

  for (const valor of valores) {
    if (typeof valor !== 'string') continue;
    const clave = normalizar(valor);
    if (!clave) continue;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }

  const ordenadas = [...cuenta.entries()]
    .map(([clave, total]) => ({ etiqueta: capitalizar(clave), total }))
    .sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta, 'es'));

  if (ordenadas.length <= top) return ordenadas;

  const cabeza = ordenadas.slice(0, top);
  const cola = ordenadas.slice(top).reduce((suma, fila) => suma + fila.total, 0);
  return [...cabeza, { etiqueta: 'Otros', total: cola }];
}
