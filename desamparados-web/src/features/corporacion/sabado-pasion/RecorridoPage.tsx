import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'

/**
 * El recorrido de la estación de penitencia. Se edita desde el CMS, en «Web
 * pública → Páginas», como el resto de la web pública: hasta septiembre de 2026
 * tenía su propia pantalla con un formulario fijo y no se le podían añadir ni
 * quitar secciones.
 */
export default function RecorridoPage() {
  return <PaginaDeBloquesPublica slug="recorrido" />
}
