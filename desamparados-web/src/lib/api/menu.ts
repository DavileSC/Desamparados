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

/** Las páginas por su ruta; los títulos de primer nivel, por `claveDeSeccion`. */
export const NOMBRE_DE_SIEMPRE: ReadonlyMap<string, string> = new Map([...CATALOGO.entradas, ...CATALOGO.secciones].map((e) => [e.ruta, e.nombre]))
/** Caracteres como mucho: el servidor rechaza uno más largo. */
export const TOPE_NOMBRE_EN_MENU = CATALOGO.tope

/** Sin sesión: la barra los pinta para cualquiera. */
export const nombresEnMenu = () => llamarApi<{ nombres: NombresEnMenu }>('/menu', { auth: false }).then((r) => r.nombres)

/**
 * Uno solo: el servidor lo mezcla con lo que tiene guardado (vacío o igual al
 * de siempre, vuelve el de siempre) y devuelve todos. Mezclarlo aquí, sobre
 * una copia que puede no haber llegado o ser vieja, borraba los demás.
 */
export const cambiarNombreEnMenu = (ruta: string, nombre: string) =>
  llamarApi<{ nombres: NombresEnMenu }>('/cms/menu', { method: 'PATCH', json: { ruta, nombre } }).then((r) => r.nombres)
