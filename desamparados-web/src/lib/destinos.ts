import DESTINOS from '../../../shared/destinos-de-enlace.json'
import CATALOGO from '../../../shared/paginas-publicas.json'
import { cumple, type Modulo } from '../domain/modulos'

/** Una página a la que puede llevar un enlace escrito en el CMS. */
export interface Destino {
  ruta: string
  nombre: string
  /** Para agrupar el selector como el menú de la web. */
  grupo: string
  /** El módulo de la página, si es de uno (las páginas propias); sin él, del núcleo. */
  modulo?: Modulo
}

/**
 * Las rutas fijas: las páginas por bloques y las demás de
 * `shared/destinos-de-enlace.json`. El servidor lee los mismos dos JSON y
 * rechaza cualquier otra al guardar (backend: domain/destinos.ts).
 */
export const DESTINOS_FIJOS: Destino[] = [
  ...DESTINOS.otros.filter((d) => d.grupo === 'General'),
  ...(CATALOGO.paginas as Destino[]).map(({ ruta, nombre, grupo, modulo }) => ({ ruta, nombre, grupo, modulo })),
  ...DESTINOS.otros.filter((d) => d.grupo !== 'General'),
]

/**
 * Los destinos que se ofrecen con estos módulos encendidos: una página de un
 * módulo apagado no existe en esta instalación. `esDestinoValido` sigue
 * aceptándola, como el servidor: un enlace ya guardado a ella no impide volver
 * a guardar su página (lleva a «página no encontrada», como una noticia borrada).
 */
export const destinosActivos = (activos: ReadonlySet<string>): Destino[] =>
  DESTINOS_FIJOS.filter((d) => cumple(d.modulo ?? 'nucleo', activos))

const RUTAS = new Set(DESTINOS_FIJOS.map((d) => d.ruta))

export const PREFIJO_NOTICIA = DESTINOS.prefijoNoticia
const NOTICIA = new RegExp(`^${PREFIJO_NOTICIA.replace(/\//g, '\\/')}[a-z0-9]+(?:-[a-z0-9]+)*$`)

/** El ancla de un bloque: como un slug. La misma que `ANCLA` en el servidor. */
const ANCLA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * `true` si el enlace lleva a una página que existe. El mismo criterio que el
 * servidor: una de las rutas fijas, o la de una noticia, con un ancla detrás
 * si se quiere (`/historia#fundacion`).
 */
export function esDestinoValido(enlace: string): boolean {
  const almohadilla = enlace.indexOf('#')
  const ruta = almohadilla === -1 ? enlace : enlace.slice(0, almohadilla)
  if (almohadilla !== -1 && !ANCLA.test(enlace.slice(almohadilla + 1))) return false
  return RUTAS.has(ruta) || NOTICIA.test(ruta)
}
