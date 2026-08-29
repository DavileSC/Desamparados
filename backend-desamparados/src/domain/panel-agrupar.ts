export interface Recuento {
  etiqueta: string;
  total: number;
}

/** Minúsculas, sin espacios sobrantes ni dobles: dos formas de escribir lo mismo caen juntas. */
function normalizar(valor: string): string {
  return valor.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Etiqueta legible para un grupo.
 *
 * Agrupar en minúsculas está bien —une «XXL» con «xxl»—, pero pintar la clave
 * normalizada no: las siglas salían como «Xxl» y «Xs» en la previsión de
 * túnicas. Así que se enseña la forma más repetida de escribirlo, y solo se
 * capitaliza cuando quien la escribió no puso ni una mayúscula.
 */
function etiquetaDe(variantes: Map<string, number>): string {
  const [dominante] = [...variantes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  const forma = dominante[0];
  return forma === forma.toLowerCase() ? forma.charAt(0).toUpperCase() + forma.slice(1) : forma;
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
  // Por cada grupo, cómo lo escribió cada cual y cuántas veces: de ahí sale la
  // etiqueta que se pinta.
  const variantes = new Map<string, Map<string, number>>();

  for (const valor of valores) {
    if (typeof valor !== 'string') continue;
    const clave = normalizar(valor);
    if (!clave) continue;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);

    const formas = variantes.get(clave) ?? new Map<string, number>();
    const forma = valor.trim().replace(/\s+/g, ' ');
    formas.set(forma, (formas.get(forma) ?? 0) + 1);
    variantes.set(clave, formas);
  }

  const ordenadas = [...cuenta.entries()]
    .map(([clave, total]) => ({ etiqueta: etiquetaDe(variantes.get(clave)!), total }))
    .sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta, 'es'));

  if (ordenadas.length <= top) return ordenadas;

  const cabeza = ordenadas.slice(0, top);
  const cola = ordenadas.slice(top).reduce((suma, fila) => suma + fila.total, 0);
  return [...cabeza, { etiqueta: 'Otros', total: cola }];
}
