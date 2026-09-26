import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'

/**
 * La agenda de cultos y actos, paginada. Se edita desde el CMS, en «Web pública → Páginas»:
 * la cabecera y los textos que rodean al listado son bloques, y lo que cambia
 * solo (noticias, actos, publicaciones) lo pinta un bloque de listado que lo
 * pide al abrir la página. Hasta septiembre de 2026 todo esto estaba escrito
 * en este fichero.
 */
export default function AgendaPage() {
  return <PaginaDeBloquesPublica slug="agenda" />
}
