/**
 * Mapa de la web pública: la única fuente de verdad del menú de escritorio y
 * del cajón móvil de `Navbar.tsx`.
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
  href: string
  hijos?: EntradaMenu[]
}

export const menuPublico: EntradaMenu[] = [
  { label: 'Inicio', href: '/' },
  {
    label: 'Corporación',
    href: '/corporacion',
    hijos: [
      {
        label: 'Historia',
        href: '/corporacion/historia',
        hijos: [{ label: 'Órganos de Gobierno', href: '/corporacion/historia/organos-de-gobierno' }],
      },
      { label: 'Parroquia - Pasionistas', href: '/corporacion/parroquia-pasionistas' },
      {
        label: 'Nuestros fines',
        href: '/corporacion/nuestros-fines',
        hijos: [
          { label: 'Caridad', href: '/corporacion/nuestros-fines/caridad' },
          { label: 'Formación', href: '/corporacion/nuestros-fines/formacion' },
        ],
      },
      { label: 'Cultos', href: '/corporacion/cultos' },
      {
        label: 'Sábado de Pasión',
        href: '/corporacion/sabado-de-pasion',
        hijos: [
          { label: 'Recorrido', href: '/corporacion/sabado-de-pasion/recorrido' },
          { label: 'Trono', href: '/corporacion/sabado-de-pasion/trono' },
          { label: 'Enseres', href: '/corporacion/sabado-de-pasion/enseres' },
        ],
      },
    ],
  },
  {
    label: 'Sagrada titular',
    href: '/sagrada-titular',
    hijos: [
      { label: 'Desamparados', href: '/sagrada-titular/desamparados' },
      { label: 'Ajuar', href: '/sagrada-titular/ajuar' },
    ],
  },
  {
    label: 'Actualidad',
    href: '/actualidad',
    hijos: [
      { label: 'Agenda', href: '/actualidad/agenda' },
      { label: 'Noticias', href: '/actualidad/noticias' },
    ],
  },
  {
    label: 'Publicaciones',
    href: '/publicaciones',
    hijos: [
      { label: 'Boletines', href: '/publicaciones/boletines' },
      { label: 'Dossier prensa', href: '/publicaciones/dossier-prensa' },
    ],
  },
  {
    label: 'Hermanos',
    href: '/hermanos',
    hijos: [
      { label: 'Hazte hermano', href: '/hermanos/hazte-hermano' },
      { label: 'Login hermanos', href: '/hermanos/acceso' },
    ],
  },
  { label: 'Contacto', href: '/contacto' },
]

/** Todas las entradas del árbol en orden de lectura (padre antes que hijos). */
export function aplanarMenu(entradas: EntradaMenu[]): EntradaMenu[] {
  return entradas.flatMap((entrada) => [entrada, ...aplanarMenu(entrada.hijos ?? [])])
}
