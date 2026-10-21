/**
 * Lo que una ficha del CMS entrega a quien pone sus botones: la pantalla de
 * siempre pinta su «Guardar» y el asistente de primer arranque, su «Siguiente».
 */
export interface AccionesDelFormulario {
  sinGuardar: boolean
  hayErrores: boolean
  guardando: boolean
  guardar: () => void
}
