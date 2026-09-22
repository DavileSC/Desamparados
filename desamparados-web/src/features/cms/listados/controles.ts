/**
 * Las dos piezas que comparten la barra de listado y las barras propias de
 * cada pantalla (la de Contabilidad, por ahora).
 *
 * Aparte de `BarraListado.tsx` a propósito: ese fichero exporta un componente,
 * y sacar de él cosas que no lo son rompe el *fast refresh* de Vite (aviso
 * `react/only-export-components`), igual que en `bloques/filas.ts`.
 */

// Sin esto, un desplegable sin filtro enseña su etiqueta dentro, como si estuviera vacío, en vez de «Todos».
export const SIN_VALOR_VISIBLE = { inputLabel: { shrink: true }, select: { displayEmpty: true } } as const

/**
 * Cómo se reparte un control en la barra: parte de `base` píxeles y crece
 * hasta llenar su fila. Así, quepan todos o no, cada fila queda llena de
 * borde a borde: lo que baja a la siguiente se estira en vez de quedarse
 * suelto a un lado. En el móvil, con menos sitio que `base`, cada control
 * ocupa su fila entera.
 */
export const anchoControl = (base: number, peso = 1) => ({ flex: `${peso} 1 ${base}px`, minWidth: 0 })
