import CATALOGO from '../../../../shared/entradas-del-menu.json'
import { llamarApi } from './cliente'

/**
 * El nombre de cada página en el menú público, cuando no es el de siempre:
 * ruta → nombre («/parroquia» → «Parroquia · Pasionistas»). Solo trae los que
 * cambian; lo que no está, el de siempre de `config/navegacion.ts`. Se cambian
 * en el índice de Páginas del CMS.
 */
export type NombresEnMenu = Record<string, string>

export const CLAVE_NOMBRES_EN_MENU = ['menu', 'nombres'] as const

/** Las entradas que pueden cambiar de nombre, con el de siempre (`shared/entradas-del-menu.json`). */
export const ENTRADAS_DEL_MENU: readonly { ruta: string; nombre: string }[] = CATALOGO.entradas
export const NOMBRE_DE_SIEMPRE: ReadonlyMap<string, string> = new Map(CATALOGO.entradas.map((e) => [e.ruta, e.nombre]))
/** Caracteres como mucho: el servidor rechaza uno más largo. */
export const TOPE_NOMBRE_EN_MENU = CATALOGO.tope

/** Sin sesión: la barra los pinta para cualquiera. */
export const nombresEnMenu = () => llamarApi<{ nombres: NombresEnMenu }>('/menu', { auth: false }).then((r) => r.nombres)

/**
 * Todos de una vez: el servidor quita los vacíos y los iguales al de siempre,
 * y devuelve lo que guardó. Una ruta que no es del menú es un 400 con el campo
 * `nombres./ruta`.
 */
export const guardarNombresEnMenu = (nombres: NombresEnMenu) =>
  llamarApi<{ nombres: NombresEnMenu }>('/cms/menu', { method: 'PUT', json: { nombres } }).then((r) => r.nombres)
