/**
 * Los colores de la papeleta en pantalla (la tarjeta y el modo puerta): negro
 * y oro como la portada del Informe anual, y fijos, sin seguir el tema claro u
 * oscuro de la web. Es un documento: se ve igual siempre.
 */
export const NEGRO = '#161214'
export const ORO = '#cdae72'
export const CREMA = '#f4efe5'
export const GRIS = '#b9b1a8'
export const FILETE = '#4a3f35'
export const BURDEOS = '#5c1622'
export const SERIFA = 'Georgia, "Times New Roman", serif'

/** El QR de la papeleta como imagen: el servidor lo manda en SVG. */
export const imagenDelQr = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
