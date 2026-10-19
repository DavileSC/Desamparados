/**
 * Los móviles en los que el acceso de hermanos no cabe entero sin hacer
 * scroll. Se mide el alto que deja el navegador, no el del teléfono: un
 * iPhone SE con las barras de Safari se queda en unos 550 px.
 *
 * Por escalones, de menos a más recorte: por debajo de `MOVIL_MEDIO` se quita
 * la explicación del alta; de `MOVIL_BAJO`, también el subtítulo del
 * formulario; de `MOVIL_MINIMO` (los de hace años, ~460 px), el título del
 * alta, que deja solo su botón, y se aprietan los huecos. `MOVIL_ESTRECHO`
 * (320 px de ancho) achica la fila de «Recuérdame» para que no se parta.
 * Lo que entra siempre: los campos, «Recuérdame», «Entrar» y el botón del alta.
 */
export const MOVIL_MEDIO = '@media (max-width: 899.95px) and (max-height: 719.95px)'
export const MOVIL_BAJO = '@media (max-width: 899.95px) and (max-height: 649.95px)'
export const MOVIL_MINIMO = '@media (max-width: 899.95px) and (max-height: 519.95px)'
export const MOVIL_ESTRECHO = '@media (max-width: 359.95px)'
