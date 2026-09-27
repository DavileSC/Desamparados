import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'

/**
 * El Rosario vespertino de octubre. Todo su contenido —la cabecera, el
 * itinerario en texto y la galería— se edita desde el CMS, en «Web pública →
 * Páginas»; los valores de partida están en `shared/contenido-por-defecto.json`.
 */
export default function RosarioPage() {
  return <PaginaDeBloquesPublica slug="rosario" />
}
