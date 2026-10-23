/**
 * Lo que sigue abierto con la web cerrada: los textos legales (la ley los
 * pide a la vista, y «Próximamente» los enlaza), la baja del boletín, que
 * llega por correo, y la vuelta del pago de la tienda y del apadrinamiento,
 * que puede ser de alguien que pagó antes de cerrarla.
 */
const ABIERTAS_SIEMPRE = /^\/(aviso-legal|politica-privacidad|politica-cookies|condiciones-de-compra|boletin\/baja|tienda\/pedido\/[^/]+|apadrina\/gracias\/[^/]+)\/?$/

export function siempreAbierta(ruta: string): boolean {
  return ABIERTAS_SIEMPRE.test(ruta)
}
