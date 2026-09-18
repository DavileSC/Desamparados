import PaginaDeBloquesPublica from '../../components/bloques/PaginaDeBloquesPublica'

/**
 * La página de Contacto. Se edita desde el CMS, en «Web pública → Páginas»: la
 * cabecera, la tarjeta de datos y lo que se quiera poner alrededor. El
 * formulario en sí es el bloque de contacto (`BloqueContacto`), que sigue siendo
 * de código porque lo que envía llega por correo. Hasta septiembre de 2026 la
 * página entera estaba escrita en este fichero.
 */
export default function ContactPage() {
  return <PaginaDeBloquesPublica slug="contacto" />
}
