/**
 * Lleva el foco al campo `nombre` de un formulario, el que falla al validar.
 * El de un desplegable de MUI es el `combobox` de al lado: el `input` que
 * lleva el `name` está oculto y no admite el foco.
 */
export function enfocarCampo(formulario: HTMLFormElement | null, nombre: string) {
  const elemento = formulario?.querySelector<HTMLElement>(`[name="${nombre}"]`)
  const destino = elemento?.classList.contains('MuiSelect-nativeInput') ? elemento.parentElement?.querySelector<HTMLElement>('[role="combobox"]') : elemento
  destino?.focus()
}
