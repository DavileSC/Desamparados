/**
 * Pasa el foco al primer campo marcado con error dentro de `contenedor`. Lo
 * usan los formularios de pago que validan al pulsar: tras pintar los avisos
 * (con `flushSync`), el foco va a lo primero que hay que corregir. Un grupo de
 * botones sin campo (el destino del donativo) se marca con `data-falta`.
 */
export function enfocarLoQueFalla(contenedor: HTMLElement | null) {
  contenedor?.querySelector<HTMLElement>('[aria-invalid="true"], [data-falta]')?.focus()
}
