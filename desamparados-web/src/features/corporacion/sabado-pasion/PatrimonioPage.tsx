import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'

/**
 * El patrimonio del Sábado de Pasión: el trono, los enseres y el cortejo, cada
 * uno en su sección con ancla (`#trono`, `#enseres`, `#cortejo`). Todo se edita
 * desde el CMS, en «Web pública → Páginas». Hasta el 26-11-2026 el trono y los
 * enseres eran dos páginas; sus direcciones ya no existen.
 */
export default function PatrimonioPage() {
  return <PaginaDeBloquesPublica slug="patrimonio" />
}
