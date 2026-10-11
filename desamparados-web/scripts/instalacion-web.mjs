// Los ficheros de la web que dicen quién es la corporación, escritos junto a la
// web compilada al ARRANCAR, no al construir: así una misma imagen sirve a
// cualquier corporación, y sus datos (instalacion/datos-entidad.json, fuera de
// git y de la imagen) se montan en el contenedor como en la API.
//
//   node desamparados-web/scripts/instalacion-web.mjs --plantilla <index.html> \
//     --destino <carpeta> [--datos <json>] [--comprimir]
//
// Escribe en <carpeta>:
//   - index.html, de la plantilla (el index.html del repositorio, o el de
//     dist/ ya compilado, que conserva sus {{…}}): lo que leen WhatsApp,
//     Facebook o Google sin ejecutar JavaScript. Con --comprimir, también su
//     .gz, porque nginx sirve el .gz que encuentre al lado (gzip_static) y uno
//     hecho de la plantilla publicaría las marcas.
//   - manifest.json y robots.txt.
//   - instalacion.js, que pone en `window.__INSTALACION__` lo que la web lee
//     de la corporación (src/config/instalacion.ts). Es un fichero y no un
//     <script> en línea: la CSP solo deja ejecutar scripts del propio origen.
//
// Comprueba todo ANTES de escribir nada: con un dato mal puesto el contenedor
// no arranca y deja la carpeta como estaba, en vez de servir media web. Sin
// --datos lee el fichero de la instalación (shared/datos-entidad.mjs: en las
// pruebas, el ejemplo).
//
// Solo importa de shared/ y de node: el contenedor de nginx tiene Node, pero
// ninguna dependencia de la web. Las funciones las usan también el plugin de
// Vite (scripts/instalacion-vite.mjs) y las pruebas.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import { leerDatosEntidad, rutaDeDatosEntidad } from '../../shared/datos-entidad.mjs'

/**
 * Lo que la web recibe de la corporación: la identidad y la marca, campo a
 * campo. Se copian uno a uno y no con `...datos.identidad` para que un dato
 * nuevo del fichero no acabe publicado sin que nadie lo decida. Secretaría, la
 * sede, las redes y la privacidad no van: se cambian en el CMS y la web las
 * pide a la API (`GET /api/corporacion`), igual que los módulos.
 */
export function instalacionPublica({ identidad: i, marca: m }) {
  return {
    identidad: {
      nombre: i.nombre,
      nombreCorto: i.nombreCorto,
      tipo: i.tipo,
      tipoCorto: i.tipoCorto,
      articulo: i.articulo,
      titular: i.titular,
      localidad: i.localidad,
      dominio: i.dominio,
      descripcion: i.descripcion,
      denominacion: i.denominacion,
      domicilio: i.domicilio,
      normas: i.normas ? { titulo: i.normas.titulo, url: i.normas.url } : null,
    },
    marca: { colorPrincipal: m.colorPrincipal, colorAcento: m.colorAcento },
  }
}

const html = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Dentro de un <script>: sin «<», un «</script>» del dato no cerraría el bloque.
const json = (v) => JSON.stringify(String(v)).slice(1, -1).replace(/</g, '\\u003c')

/**
 * La plantilla con sus marcas rellenas: `{{clave}}` escapada para HTML y
 * `{{json:clave}}` para ir dentro de una cadena JSON. Una marca que no existe
 * es un error: se quedaría escrita tal cual en la web publicada.
 */
export function rellenarIndex(plantilla, { identidad }) {
  const valores = {
    nombre: identidad.nombre,
    titular: identidad.titular,
    localidad: identidad.localidad,
    descripcion: identidad.descripcion,
    url: `https://${identidad.dominio}`,
    denominacion: identidad.denominacion,
  }
  const valor = (clave) => {
    if (!(clave in valores)) throw new Error(`La plantilla usa {{${clave}}}, que no existe en scripts/instalacion-web.mjs.`)
    return valores[clave]
  }
  const salto = plantilla.includes('\r\n') ? '\r\n' : '\n'
  const lineas = plantilla.split(/\r?\n/)
    // Un dato pendiente (null) no se inventa: su línea del JSON-LD desaparece.
    .filter((linea) => ![...linea.matchAll(/\{\{json:(\w+)\}\}/g)].some(([, clave]) => valor(clave) == null))
    .map((linea) => linea
      .replace(/\{\{json:(\w+)\}\}/g, (_, clave) => json(valor(clave)))
      .replace(/\{\{(\w+)\}\}/g, (_, clave) => html(valor(clave))))
  // Sin cerrar con una coma colgando si la última propiedad era la quitada.
  return lineas.join(salto).replace(/,(\s*\r?\n\s*[}\]])/g, '$1')
}

/**
 * La plantilla tiene que cargar /instalacion.js como script clásico y antes
 * que el código de la web: sin él, la web arranca sin datos y solo enseña el
 * aviso de que faltan. Se comprueba aquí y no solo en las pruebas porque la
 * plantilla del contenedor es la que sale de `vite build`.
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
  return null
}

export const manifest = ({ identidad }) => JSON.stringify({
  name: identidad.nombre,
  short_name: identidad.nombreCorto,
  lang: 'es',
  start_url: '/',
  scope: '/',
  display: 'browser',
  background_color: '#070608',
  theme_color: '#070608',
  icons: [
    { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n'

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

// Congelado: nada de la web puede cambiar por accidente los datos que leen las demás piezas.
export const instalacionJs = (datos) => `window.__INSTALACION__=Object.freeze(${JSON.stringify(instalacionPublica(datos))});\n`

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
      plantilla: { type: 'string' },
      destino: { type: 'string' },
      datos: { type: 'string' },
      comprimir: { type: 'boolean', default: false },
    },
  })
  if (!values.plantilla || !values.destino) {
    throw new Error('Uso: node instalacion-web.mjs --plantilla <index.html> --destino <carpeta> [--datos <json>] [--comprimir]')
  }

  // Primero todo lo que puede fallar; después, y solo entonces, se escribe.
  const plantilla = readFileSync(resolve(values.plantilla), 'utf8')
  const problema = comprobarPlantilla(plantilla)
  if (problema) throw new Error(`${values.plantilla} ${problema}`)
  const datos = leerDatos(values.datos)
  const index = rellenarIndex(plantilla, datos)
  const ficheros = [
    ['index.html', index],
    ['manifest.json', manifest(datos)],
    ['robots.txt', robots(datos)],
    ['instalacion.js', instalacionJs(datos)],
  ]
  // Node no escribe la hora en la cabecera del gzip: sale igual en cada arranque.
  if (values.comprimir) ficheros.push(['index.html.gz', gzipSync(index, { level: 9 })])

  const destino = resolve(values.destino)
  mkdirSync(destino, { recursive: true })
  for (const [nombre, contenido] of ficheros) writeFileSync(join(destino, nombre), contenido)
  console.log(`[instalacion-web] ${datos.identidad.nombre} (${datos.identidad.dominio}): ${ficheros.map(([n]) => n).join(', ')} en ${destino}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    orden(process.argv.slice(2))
  } catch (error) {
    console.error(`[instalacion-web] ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
