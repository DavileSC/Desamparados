import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'

/**
 * Los fines del Grupo Parroquial. Todo su contenido —la cabecera y los bloques— se edita desde el
 * CMS, en «Web pública → Páginas». Lo que antes vivía escrito aquí está ahora
 * en `shared/contenido-por-defecto.json` como valores de partida.
 */
export default function NuestrosFinesPage() {
  return <PaginaDeBloquesPublica slug="nuestros-fines" />
}
