import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'

/**
 * Los cultos del año. Todo su contenido —la cabecera y los bloques— se edita desde el
 * CMS, en «Web pública → Páginas». Lo que antes vivía escrito aquí está ahora
 * en `shared/contenido-por-defecto.json` como valores de partida.
 *
 * Sin la cabecera grande: la abre el rostro de la Virgen fundido en negro (un
 * bloque de foto con texto), que ya dice qué página es.
 */
export default function CultosPage() {
  return <PaginaDeBloquesPublica slug="cultos" sinCabecera />
}
