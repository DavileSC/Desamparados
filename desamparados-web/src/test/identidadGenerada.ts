import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs'
import { INCLUSION_CABECERA, cabeceraHtml, manifest } from '../../../shared/instalacion-publica.mjs'
import { robots } from '../../scripts/instalacion-web.mjs'
import { MARCA_DE_PARTIDA } from './instalacion'

/**
 * index.html como lo sirve nginx (con la cabecera que publica la API metida
 * por SSI), el manifest que publica la API y el robots.txt del arranque del
 * contenedor, con la instalación de las pruebas (el ejemplo) y la marca de
 * partida.
 */
export function identidadGenerada() {
  const datos = leerDatosEntidad()
  const index = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
  return {
    html: index.replace(INCLUSION_CABECERA, () => cabeceraHtml(datos, MARCA_DE_PARTIDA)),
    manifiesto: manifest(datos, MARCA_DE_PARTIDA),
    robots: robots(datos),
  }
}
