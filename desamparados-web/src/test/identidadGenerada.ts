import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs'
import { manifest, rellenarIndex, robots } from '../../scripts/instalacion-web.mjs'

/**
 * index.html, el manifest y robots.txt como los escribe
 * `scripts/instalacion-web.mjs` al arrancar el contenedor, con la instalación
 * de las pruebas (el ejemplo). El index.html del repositorio es la plantilla,
 * con sus marcas sin rellenar.
 */
export function identidadGenerada() {
  const datos = leerDatosEntidad()
  return {
    html: rellenarIndex(readFileSync(join(process.cwd(), 'index.html'), 'utf8'), datos),
    manifiesto: manifest(datos),
    robots: robots(datos),
  }
}
