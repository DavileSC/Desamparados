import PaginaDeBloquesPublica from '../../components/bloques/PaginaDeBloquesPublica'

/**
 * La portada de la sección Corporación. Todo su contenido —la cabecera y los bloques— se edita desde el
 * CMS, en «Web pública → Páginas». Lo que antes vivía escrito aquí está ahora
 * en `shared/contenido-por-defecto.json` como valores de partida.
 */
export default function CorporacionPage() {
  return <PaginaDeBloquesPublica slug="corporacion" />
}
