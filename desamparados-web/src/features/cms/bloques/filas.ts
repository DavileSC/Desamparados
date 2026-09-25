import type { Bloque } from '../../../lib/api/contenido'

/**
 * Aparte de `constructor/ListaDeBloques.tsx` a propósito: son funciones sueltas, no un
 * componente, y ese fichero ya exporta el editor por defecto. Exportar las dos
 * cosas del mismo fichero rompe el *fast refresh* de Vite (aviso
 * `react/only-export-components`). Por lo mismo están aparte
 * `app/useTemaCms.ts`, `cms/listados/controles.ts` y
 * `cms/redaccion/textos.ts`.
 */

/** La clave la pone el CMS para que React siga la fila al reordenarla. */
export interface Fila { bloque: Bloque; clave: number }

let ultimaClave = 0
export const conClave = (bloque: Bloque): Fila => ({ bloque, clave: ++ultimaClave })
export const sinClave = (filas: Fila[]): Bloque[] => filas.map((f) => f.bloque)
