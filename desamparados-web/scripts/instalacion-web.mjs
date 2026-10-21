// Lo que el contenedor de la web comprueba y escribe al ARRANCAR, no al
// construir: así una misma imagen sirve a cualquier corporación, y sus datos
// (instalacion/datos-entidad.json, fuera de git y de la imagen) se montan en el
// contenedor como en la API.
//
//   node desamparados-web/scripts/instalacion-web.mjs --index <index.html> \
//     --destino <carpeta> [--datos <json>]
//
//   node desamparados-web/scripts/instalacion-web.mjs --publicar <carpeta> \
//     [--datos <json>] [--marca <carpeta>]
//
// Comprueba el index.html de `vite build` (que cargue /instalacion.js antes que
// la web y lleve el sitio de la cabecera) y el fichero de la instalación, y
// escribe robots.txt en <carpeta>, con el dominio. Lo demás que dice quién es
// la corporación (/instalacion.js, /manifest.json, la cabecera de index.html y
// /marca/) ya no sale de aquí: lo escribe la API en storage/public con lo
// guardado en el CMS, que es donde se cambia (shared/instalacion-publica.mjs).
//
// Con --publicar hace lo que hace la API, con el fichero y la marca de la
// instalación (sin --marca, instalacion/marca): escribe en <carpeta> lo que
// nginx lee de storage/public. Para probar la imagen de la web sin la API (las
// pruebas de humo del CI).
//
// Comprueba todo ANTES de escribir nada: con un dato mal puesto el contenedor
// no arranca, en vez de servir media web. Sin --datos lee el fichero de la
// instalación (shared/datos-entidad.mjs: en las pruebas, el ejemplo).
//
// Solo importa de shared/ y de node: el contenedor de nginx tiene Node, pero
// ninguna dependencia de la web.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { leerDatosEntidad, rutaDeDatosEntidad } from '../../shared/datos-entidad.mjs'
import { INCLUSION_CABECERA, leerMarcaDe, publicarInstalacion } from '../../shared/instalacion-publica.mjs'
import { rutaDeMarca } from '../../shared/marca.mjs'

export {
  cabeceraHtml, copiarMarca, imagenesDeMarca, instalacionJs, instalacionPublica, leerMarcaDe, manifest, rellenarIndex, urlDeMarca,
} from '../../shared/instalacion-publica.mjs'

/**
 * index.html tiene que cargar /instalacion.js como script clásico y antes que
 * el código de la web (sin él, la web arranca sin datos y solo enseña el aviso
 * de que faltan) y llevar el sitio donde nginx mete la cabecera (sin él, la web
 * sale sin título ni iconos). Se comprueba aquí y no solo en las pruebas porque
 * el del contenedor es el que sale de `vite build`.
 */
export function comprobarPlantilla(plantilla) {
  const script = plantilla.search(/<script src="\/instalacion\.js"><\/script>/)
  if (script === -1) {
    return 'no carga <script src="/instalacion.js"></script>: la web arrancaría sin los datos de la corporación.'
  }
  const modulo = plantilla.search(/<script[^>]*type="module"/)
  if (modulo !== -1 && modulo < script) {
    return 'carga /instalacion.js después del código de la web (type="module"): tiene que ir antes, en <head>.'
  }
  if (!plantilla.includes(INCLUSION_CABECERA)) {
    return `no lleva ${INCLUSION_CABECERA}: la web saldría sin título, iconos ni vista previa al compartir.`
  }
  return null
}

export const robots = ({ identidad }) => [
  'User-agent: *',
  'Disallow: /cms',
  'Disallow: /area-hermano',
  'Disallow: /acceso',
  'Disallow: /reset-password',
  // Llevan en la dirección la clave de un pedido o de un pago: son de quien
  // pagó, no de un buscador.
  'Disallow: /tienda/pedido/',
  'Disallow: /apadrina/gracias/',
  `Sitemap: https://${identidad.dominio}/sitemap.xml`,
  '',
].join('\n')

const MONTAJE = 'En el contenedor de la web, ./instalacion tiene que estar montada en /app/instalacion (compose.yaml, servicio web).'

/** Los datos, de --datos (relativa a donde se ejecuta) o del fichero de la instalación. */
function leerDatos(pedidos) {
  if (pedidos) {
    const ruta = resolve(pedidos)
    if (!existsSync(ruta)) throw new Error(`No existe ${ruta}. ${MONTAJE}`)
    return leerDatosEntidad({ DATOS_ENTIDAD: ruta })
  }
  try {
    rutaDeDatosEntidad()
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\n${MONTAJE}`)
  }
  return leerDatosEntidad()
}

function orden(argumentos) {
  const { values } = parseArgs({
    args: argumentos,
    options: {
      index: { type: 'string' },
      destino: { type: 'string' },
      datos: { type: 'string' },
      publicar: { type: 'string' },
      marca: { type: 'string' },
    },
  })
  if (values.publicar) {
    const datos = leerDatos(values.datos)
    const ficheros = leerMarcaDe(values.marca ? resolve(values.marca) : rutaDeMarca())
    publicarInstalacion(resolve(values.publicar), datos, ficheros)
    console.log(`[instalacion-web] ${datos.identidad.nombre}: instalacion/ y marca/ en ${resolve(values.publicar)}.`)
    return
  }
  if (!values.index || !values.destino) {
    throw new Error('Uso: node instalacion-web.mjs --index <index.html> --destino <carpeta> [--datos <json>] | --publicar <carpeta> [--datos <json>] [--marca <carpeta>]')
  }

  // Primero todo lo que puede fallar; después, y solo entonces, se escribe.
  const problema = comprobarPlantilla(readFileSync(resolve(values.index), 'utf8'))
  if (problema) throw new Error(`${values.index} ${problema}`)
  const datos = leerDatos(values.datos)

  const destino = resolve(values.destino)
  mkdirSync(destino, { recursive: true })
  writeFileSync(join(destino, 'robots.txt'), robots(datos))
  console.log(`[instalacion-web] ${datos.identidad.dominio}: robots.txt en ${destino}. El nombre y la marca los escribe la API.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    orden(process.argv.slice(2))
  } catch (error) {
    console.error(`[instalacion-web] ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
