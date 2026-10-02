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
import { cumple, type Modulo } from '../domain/modulos'

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
  /** De qué módulo es: apagado, la entrada no sale. Una sección que se queda sin hijos tampoco. */
  modulo: Modulo
}

// La guardiana del backend (`test/modulos-cobertura.test.ts`) lee este fichero
// línea a línea y exige `modulo:` en toda línea que lleve `label:`, también en
// las secciones de varias líneas (va pegado a `label` y `href`, `hijos`, etc.
// siguen debajo tal cual).
export const menuPublico: EntradaMenu[] = [
  { label: 'Inicio', href: '/', modulo: 'nucleo' },
  {
    label: 'Corporación', modulo: 'nucleo',
    href: '/corporacion',
    hijos: [
      {
        label: 'Historia', modulo: 'nucleo',
        href: '/historia',
        hijos: [{ label: 'Órganos de Gobierno', href: '/historia/organos-de-gobierno', modulo: 'nucleo' }],
      },
      { label: 'Parroquia · Pasionistas', href: '/parroquia-pasionistas', modulo: 'nucleo' },
      {
        label: 'Nuestros fines', modulo: 'nucleo',
        href: '/nuestros-fines',
        hijos: [
          { label: 'Caridad', href: '/nuestros-fines/caridad', modulo: 'nucleo' },
          { label: 'Formación', href: '/nuestros-fines/formacion', modulo: 'nucleo' },
        ],
      },
      { label: 'Cultos', href: '/cultos', modulo: 'nucleo' },
      {
        label: 'Sábado de Pasión', modulo: 'nucleo',
        href: '/sabado-de-pasion',
        hijos: [
          { label: 'Recorrido', href: '/sabado-de-pasion/recorrido', modulo: 'nucleo' },
          { label: 'Trono', href: '/sabado-de-pasion/trono', modulo: 'nucleo' },
          { label: 'Enseres', href: '/sabado-de-pasion/enseres', modulo: 'nucleo' },
        ],
      },
      { label: 'Rosario', href: '/rosario', modulo: 'nucleo' },
    ],
  },
  {
    label: 'Sagrada titular', modulo: 'nucleo',
    href: '/sagrada-titular',
    hijos: [
      { label: 'Desamparados', href: '/desamparados', modulo: 'nucleo' },
      { label: 'Ajuar', href: '/ajuar', modulo: 'nucleo' },
      { label: 'Apadrina', href: '/apadrina', modulo: 'apadrinamientos' },
    ],
  },
  {
    label: 'Actualidad', modulo: 'nucleo',
    href: '/actualidad',
    hijos: [
      { label: 'Agenda', href: '/agenda', modulo: 'agenda' },
      { label: 'Noticias', href: '/noticias', modulo: 'noticias' },
      { label: 'Tienda', href: '/tienda', modulo: 'tienda-web' },
    ],
  },
  {
    label: 'Publicaciones', modulo: 'nucleo',
    href: '/publicaciones',
    hijos: [
      // El archivo entero: el único sitio donde salen los anuarios y las de historia.
      { label: 'Todas las publicaciones', href: '/publicaciones', exacta: true, modulo: 'publicaciones' },
      { label: 'Boletines', href: '/publicaciones/boletines', modulo: 'publicaciones' },
      { label: 'Dossier prensa', href: '/publicaciones/dossier-prensa', modulo: 'publicaciones' },
    ],
  },
  {
    label: 'Hermanos', modulo: 'nucleo',
    href: '/hermanos',
    hijos: [
      { label: 'Hazte hermano', href: '/hazte-hermano', modulo: 'alta-web' },
      { label: 'Acceso hermanos', href: '/acceso', modulo: 'area-hermanos' },
    ],
  },
  { label: 'Contacto', href: '/contacto', modulo: 'nucleo' },
]

/** Todas las entradas del árbol en orden de lectura (padre antes que hijos). */
export function aplanarMenu(entradas: EntradaMenu[]): EntradaMenu[] {
  return entradas.flatMap((entrada) => [entrada, ...aplanarMenu(entrada.hijos ?? [])])
}

/**
 * El menú con estos módulos encendidos. Una sección (que no es enlace) que se
 * quede sin hijos desaparece: un título que no despliega nada confunde.
 */
export function menuVisible(entradas: EntradaMenu[], activos: ReadonlySet<string>): EntradaMenu[] {
  return entradas.flatMap((e) => {
    if (!cumple(e.modulo, activos)) return []
    if (!e.hijos) return [e]
    const hijos = menuVisible(e.hijos, activos)
    return hijos.length === 0 ? [] : [{ ...e, hijos }]
  })
}
