import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs'
import { resolverMarca } from '../../../shared/marca.mjs'
import { instalacionPublica } from '../../scripts/instalacion-web.mjs'

/**
 * La instalación de las pruebas: el fichero entero (en Vitest, siempre el
 * ejemplo, shared/datos-entidad.ejemplo.json) y lo que de él recibe la web en
 * `window.__INSTALACION__`, armado con la misma función que escribe
 * /instalacion.js al arrancar el contenedor. `setup.ts` lo pone en `window`
 * antes de que ninguna prueba importe la web.
 *
 * Secretaría, sede, redes y privacidad no llegan por ahí sino de la API: las
 * siembra `queryClient.ts` desde `DATOS`. Una prueba que necesite otra red
 * puede cambiar `DATOS.redes` antes de pintar (es el mismo objeto).
 *
 * La marca, la de partida (el escudo genérico): las pruebas no dependen de las
 * imágenes que haya en instalacion/marca de esta máquina.
 */
export const DATOS = leerDatosEntidad()
export const MARCA_DE_PARTIDA = resolverMarca().ficheros
export const INSTALACION = instalacionPublica(DATOS, MARCA_DE_PARTIDA)
