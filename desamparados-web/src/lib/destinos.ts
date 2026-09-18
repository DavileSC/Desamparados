import DESTINOS from '../../../shared/destinos-de-enlace.json'
import CATALOGO from '../../../shared/paginas-publicas.json'

/** Una página a la que puede llevar un enlace escrito en el CMS. */
export interface Destino {
  ruta: string
  nombre: string
  /** Para agrupar el selector como el menú de la web. */
  grupo: string
}

/**
 * Las rutas fijas: las páginas por bloques y las demás de
 * `shared/destinos-de-enlace.json`. El servidor lee los mismos dos JSON y
 * rechaza cualquier otra al guardar (backend: domain/destinos.ts).
 */
export const DESTINOS_FIJOS: Destino[] = [
  ...DESTINOS.otros.filter((d) => d.grupo === 'General'),
  ...CATALOGO.paginas.map((p) => ({ ruta: p.ruta, nombre: p.nombre, grupo: p.grupo })),
  ...DESTINOS.otros.filter((d) => d.grupo !== 'General'),
]

const RUTAS = new Set(DESTINOS_FIJOS.map((d) => d.ruta))

export const PREFIJO_NOTICIA = DESTINOS.prefijoNoticia
const NOTICIA = new RegExp(`^${PREFIJO_NOTICIA.replace(/\//g, '\\/')}[a-z0-9]+(?:-[a-z0-9]+)*$`)

/**
 * `true` si el enlace lleva a una página que existe. El mismo criterio que el
 * servidor: una de las rutas fijas, o la de una noticia.
 */
export const esDestinoValido = (enlace: string): boolean => RUTAS.has(enlace) || NOTICIA.test(enlace)

/** El nombre legible de una ruta fija, o `null` si no es de la lista. */
export const nombreDeDestino = (enlace: string): string | null =>
  DESTINOS_FIJOS.find((d) => d.ruta === enlace)?.nombre ?? null
