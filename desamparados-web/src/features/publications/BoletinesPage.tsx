import PaginaDeBloquesPublica from '../../components/bloques/PaginaDeBloquesPublica'

/**
 * Los boletines anuales, paginados. Se edita desde el CMS, en «Web pública → Páginas»:
 * la cabecera y los textos que rodean al listado son bloques, y lo que cambia
 * solo (noticias, actos, publicaciones) lo pinta un bloque de listado que lo
 * pide al abrir la página. Hasta septiembre de 2026 todo esto estaba escrito
 * en este fichero.
 */
export default function BoletinesPage() {
  return <PaginaDeBloquesPublica slug="boletines" />
}
