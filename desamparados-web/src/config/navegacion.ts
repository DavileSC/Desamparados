/**
 * Mapa de la web pública: la única fuente de verdad del menú de escritorio y
 * del cajón móvil de `BarraDeNavegacion.tsx`.
 *
 * Reproduce el árbol de secciones tal cual se aprobó (10-09-2026): siete
 * entradas de primer nivel y hasta dos niveles más por debajo. Las rutas ya
 * existían en `routes/index.tsx`; lo que faltaba era que el menú las enseñara.
 *
 * Es datos puros, sin React: `navegacion.test.ts` lo compara con las rutas
 * declaradas en el router para que un enlace del menú no pueda apuntar a un 404
 * sin que un test lo note.
 */

export interface EntradaMenu {
  label: string
  /**
   * En una sección con subpáginas no es un enlace: el título solo despliega y
   * se entra por las de dentro, y su `href` es solo su clave. Sus portadas se
   * quitaron el 25-09-2026 y las subpáginas dejaron de colgar de ella
   * (/corporacion/historia es ahora /historia): la sección se marca activa
   * cuando lo está alguna de las suyas (`seccionActiva`).
   */
  href: string
  hijos?: EntradaMenu[]
  /** Activa solo en su ruta exacta, no en las que cuelgan de ella. */
  exacta?: true
}

export const menuPublico: EntradaMenu[] = [
  { label: 'Inicio', href: '/' },
  {
    label: 'Corporación',
    href: '/corporacion',
    hijos: [
      {
        label: 'Historia',
        href: '/historia',
        hijos: [{ label: 'Órganos de Gobierno', href: '/historia/organos-de-gobierno' }],
      },
      { label: 'Parroquia - Pasionistas', href: '/parroquia-pasionistas' },
      {
        label: 'Nuestros fines',
        href: '/nuestros-fines',
        hijos: [
          { label: 'Caridad', href: '/nuestros-fines/caridad' },
          { label: 'Formación', href: '/nuestros-fines/formacion' },
        ],
      },
      { label: 'Cultos', href: '/cultos' },
      {
        label: 'Sábado de Pasión',
        href: '/sabado-de-pasion',
        hijos: [
          { label: 'Recorrido', href: '/sabado-de-pasion/recorrido' },
          { label: 'Trono', href: '/sabado-de-pasion/trono' },
          { label: 'Enseres', href: '/sabado-de-pasion/enseres' },
        ],
      },
      { label: 'Rosario', href: '/rosario' },
    ],
  },
  {
    label: 'Sagrada titular',
    href: '/sagrada-titular',
    hijos: [
      { label: 'Desamparados', href: '/desamparados' },
      { label: 'Ajuar', href: '/ajuar' },
    ],
  },
  {
    label: 'Actualidad',
    href: '/actualidad',
    hijos: [
      { label: 'Agenda', href: '/agenda' },
      { label: 'Noticias', href: '/noticias' },
    ],
  },
  {
    label: 'Publicaciones',
    href: '/publicaciones',
    hijos: [
      // El archivo entero: el único sitio donde salen los anuarios y las de historia.
      { label: 'Todas las publicaciones', href: '/publicaciones', exacta: true },
      { label: 'Boletines', href: '/publicaciones/boletines' },
      { label: 'Dossier prensa', href: '/publicaciones/dossier-prensa' },
    ],
  },
  {
    label: 'Hermanos',
    href: '/hermanos',
    hijos: [
      { label: 'Hazte hermano', href: '/hazte-hermano' },
      { label: 'Login hermanos', href: '/acceso' },
    ],
  },
  { label: 'Contacto', href: '/contacto' },
]

/** Todas las entradas del árbol en orden de lectura (padre antes que hijos). */
export function aplanarMenu(entradas: EntradaMenu[]): EntradaMenu[] {
  return entradas.flatMap((entrada) => [entrada, ...aplanarMenu(entrada.hijos ?? [])])
}
