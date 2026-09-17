import type { Bloque } from '../../../lib/api/contenido'

/**
 * Aparte de `EditorDeBloques.tsx` a propósito: son funciones sueltas, no un
 * componente, y ese fichero ya exporta el editor por defecto. Exportar las dos
 * cosas del mismo fichero rompe el *fast refresh* de Vite (aviso
 * `react/only-export-components`), igual que le pasaría a `useTemaCms` si no
 * fuera un caso ya asumido en `app/temaCms.tsx`.
 */

/** La clave la pone el CMS para que React siga la fila al reordenarla. */
export interface Fila { bloque: Bloque; clave: number }

let ultimaClave = 0
export const conClave = (bloque: Bloque): Fila => ({ bloque, clave: ++ultimaClave })
export const sinClave = (filas: Fila[]): Bloque[] => filas.map((f) => f.bloque)
