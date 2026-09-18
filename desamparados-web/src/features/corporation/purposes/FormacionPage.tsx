import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'

/**
 * La formación. Todo su contenido —la cabecera y los bloques— se edita desde el
 * CMS, en «Web pública → Páginas». Lo que antes vivía escrito aquí está ahora
 * en `shared/contenido-por-defecto.json` como valores de partida.
 */
export default function FormacionPage() {
  return <PaginaDeBloquesPublica slug="formacion" />
}
