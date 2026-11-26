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
// siguen debajo tal cual). Las páginas propias de una corporación llevan
// 'paginas-propias', que solo enciende el fichero de su instalación.
export const menuPublico: EntradaMenu[] = [
  { label: 'Inicio', href: '/', modulo: 'nucleo' },
  // Tienda y Apadrina salieron del menú el 26-11-2026. Quitarlas de la web es
  // cosa de cada instalación: se apagan sus módulos en Sistema → «Módulos».
  {
    label: 'Actualidad', modulo: 'nucleo',
    href: '/actualidad',
    hijos: [
      { label: 'Noticias', href: '/noticias', modulo: 'noticias' },
      { label: 'Agenda', href: '/agenda', modulo: 'agenda' },
    ],
  },
  {
    label: 'Corporación', modulo: 'nucleo',
    href: '/corporacion',
    hijos: [
      {
        label: 'Historia', modulo: 'nucleo',
        href: '/historia',
        hijos: [{ label: 'Órganos de Gobierno', href: '/historia/organos-de-gobierno', modulo: 'nucleo' }],
      },
      { label: 'Parroquia', href: '/parroquia', modulo: 'nucleo' },
      {
        label: 'Nuestros fines', modulo: 'nucleo',
        href: '/nuestros-fines',
        hijos: [
          { label: 'Caridad', href: '/nuestros-fines/caridad', modulo: 'nucleo' },
          { label: 'Formación', href: '/nuestros-fines/formacion', modulo: 'nucleo' },
        ],
      },
      {
        label: 'Cultos', modulo: 'nucleo',
        href: '/cultos',
        // El Rosario colgaba suelto de Corporación (/rosario) hasta el 26-11-2026.
        hijos: [{ label: 'Rosario', href: '/cultos/rosario', modulo: 'paginas-propias' }],
      },
      {
        label: 'Sábado de Pasión', modulo: 'paginas-propias',
        href: '/sabado-de-pasion',
        hijos: [
          { label: 'Recorrido', href: '/sabado-de-pasion/recorrido', modulo: 'paginas-propias' },
          { label: 'Trono', href: '/sabado-de-pasion/trono', modulo: 'paginas-propias' },
          { label: 'Enseres', href: '/sabado-de-pasion/enseres', modulo: 'paginas-propias' },
        ],
      },
    ],
  },
  {
    label: 'Sagrada titular', modulo: 'nucleo',
    href: '/sagrada-titular',
    hijos: [
      { label: 'Desamparados', href: '/desamparados', modulo: 'paginas-propias' },
      { label: 'Ajuar', href: '/ajuar', modulo: 'nucleo' },
    ],
  },
  {
    label: 'Publicaciones', modulo: 'nucleo',
    href: '/publicaciones',
    hijos: [
      // «Todas las publicaciones» (/publicaciones, con los anuarios) salió del
      // menú el 26-11-2026; la página sigue en pie para los enlaces que la llevan.
      { label: 'Newsletter', href: '/publicaciones/newsletter', modulo: 'publicaciones' },
      { label: 'Dossier prensa', href: '/publicaciones/dossier-prensa', modulo: 'publicaciones' },
    ],
  },
  // Una sola página con las dos puertas (ya soy hermano · quiero serlo):
  // Hazte hermano cuelga de la suya.
  { label: 'Hermanos', href: '/acceso', modulo: 'area-hermanos' },
  { label: 'Contacto', href: '/contacto', modulo: 'nucleo' },
]

/**
 * El botón del acceso de la barra y del cajón: lleva a /acceso, como
 * «Hermanos» del menú, pero no se llama igual ni cambia con su nombre. Hasta
 * el 26-11-2026 la entrada del menú era «Acceso hermanos» y el botón la seguía.
 */
export const NOMBRE_DEL_ACCESO = 'Acceso hermanos'

/** Todas las entradas del árbol en orden de lectura (padre antes que hijos). */
export function aplanarMenu(entradas: EntradaMenu[]): EntradaMenu[] {
  return entradas.flatMap((entrada) => [entrada, ...aplanarMenu(entrada.hijos ?? [])])
}

/**
 * Las entradas que llevan a una página: todas menos los títulos de primer
 * nivel con subpáginas, que solo despliegan. Son las que pueden cambiar de
 * nombre desde el CMS (`shared/entradas-del-menu.json` es su copia para el
 * servidor, y `navegacion.test.ts` vigila que coincidan).
 */
export function enlacesDelMenu(entradas: EntradaMenu[]): EntradaMenu[] {
  return entradas.flatMap((e) => (e.hijos?.length ? aplanarMenu(e.hijos) : [e]))
}

/** Los títulos de primer nivel que solo despliegan: también cambian de nombre, con `claveDeSeccion`. */
export function seccionesDelMenu(entradas: EntradaMenu[]): EntradaMenu[] {
  return entradas.filter((e) => Boolean(e.hijos?.length))
}

/**
 * La clave del nombre de un título de primer nivel. No es su ruta: puede ser
 * la de una de sus páginas («Publicaciones» despliega y «/publicaciones» es
 * «Todas las publicaciones»), y cada una tiene su nombre.
 */
export const claveDeSeccion = (href: string) => `seccion:${href}`

/** El menú con los nombres que se pusieron en el CMS (ruta o `claveDeSeccion` → nombre). */
export function ponerNombres(entradas: EntradaMenu[], nombres: Readonly<Record<string, string>>, primerNivel = true): EntradaMenu[] {
  if (Object.keys(nombres).length === 0) return entradas
  return entradas.map((e) => {
    const esTitulo = primerNivel && Boolean(e.hijos?.length)
    const label = (esTitulo ? nombres[claveDeSeccion(e.href)] : nombres[e.href]) ?? e.label
    return e.hijos ? { ...e, label, hijos: ponerNombres(e.hijos, nombres, false) } : { ...e, label }
  })
}

/**
 * El menú con estos módulos encendidos. Un título de primer nivel (que no es
 * enlace) que se quede sin hijos desaparece: un título que no despliega nada
 * confunde. Por debajo, una página con subpáginas sí es un enlace: sin ellas
 * se queda como página sola (Cultos sin el Rosario de las páginas propias).
 */
export function menuVisible(entradas: EntradaMenu[], activos: ReadonlySet<string>, primerNivel = true): EntradaMenu[] {
  return entradas.flatMap((e) => {
    if (!cumple(e.modulo, activos)) return []
    if (!e.hijos) return [e]
    const hijos = menuVisible(e.hijos, activos, false)
    if (hijos.length > 0) return [{ ...e, hijos }]
    if (primerNivel) return []
    const { hijos: _sinHijos, ...sola } = e
    return [sola]
  })
}
