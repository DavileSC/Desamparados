// Dónde están los datos de la corporación de ESTA instalación, para todo lo que
// los lee en Node: la API, la siembra, los guiones de la web y la configuración
// de Vite. La web, en el navegador, los recibe por el alias
// `@instalacion/datos-entidad.json`, que Vite resuelve con esta misma función.
//
// El fichero de cada instalación vive fuera de git (instalacion/, junto al
// .env): si estuviera versionado, un «git pull» chocaría con los datos de cada
// cliente y `docker/actualizar.sh` no podría actualizar ninguna copia que no
// fuera la de Desamparados.
//
// Sin él se falla, y no se cae en el ejemplo: un servidor que arrancara con la
// corporación inventada mandaría correos y PDF con su nombre sin que nadie lo
// notara hasta verlos. Solo las pruebas usan el ejemplo sin pedirlo, porque así
// vigilan además que nada dependa de una corporación concreta.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

export const RUTA_INSTALACION = 'instalacion/datos-entidad.json'
export const RUTA_EJEMPLO = 'shared/datos-entidad.ejemplo.json'

// NODE_TEST_CONTEXT lo pone el ejecutor de pruebas de Node (el del backend) en
// cada fichero de prueba; VITEST, Vitest.
const enPruebas = (entorno) => Boolean(entorno.NODE_TEST_CONTEXT || entorno.VITEST)

/**
 * La ruta absoluta del fichero que toca: el de `DATOS_ENTIDAD` si se da
 * (relativa a la raíz del repositorio), el ejemplo en las pruebas y, si no,
 * el de la instalación. Lanza un error que dice qué hacer si no existe.
 */
export function rutaDeDatosEntidad(entorno = process.env) {
  const pedida = entorno.DATOS_ENTIDAD?.trim()
  const ruta = resolve(raiz, pedida || (enPruebas(entorno) ? RUTA_EJEMPLO : RUTA_INSTALACION))
  if (!existsSync(ruta)) {
    throw new Error(
      pedida
        ? `DATOS_ENTIDAD apunta a ${ruta}, que no existe.`
        : `Falta ${RUTA_INSTALACION}: los datos de la corporación de esta instalación. ` +
          `Cópialo de ${RUTA_EJEMPLO} y rellénalo (docs/despliegue.md, «Los datos de la corporación»).`,
    )
  }
  return ruta
}

/** El contenido del fichero de la instalación (ver `rutaDeDatosEntidad`). */
export function leerDatosEntidad(entorno = process.env) {
  return JSON.parse(readFileSync(rutaDeDatosEntidad(entorno), 'utf8'))
}
