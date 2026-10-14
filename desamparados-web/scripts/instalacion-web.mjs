// Los ficheros de la web que dicen quién es la corporación, escritos junto a la
// web compilada al ARRANCAR, no al construir: así una misma imagen sirve a
// cualquier corporación, y sus datos (instalacion/datos-entidad.json, fuera de
// git y de la imagen) se montan en el contenedor como en la API.
//
//   node desamparados-web/scripts/instalacion-web.mjs --plantilla <index.html> \
//     --destino <carpeta> [--datos <json>] [--marca <carpeta>] [--comprimir]
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
//   - marca/, con el escudo y los iconos de la corporación (los de --marca, o
//     de instalacion/marca; los que falten, de la marca de partida). Las URL
//     que los nombran llevan `?v=<hash>`: un escudo nuevo se ve al momento
//     aunque el viejo siga en la caché de alguien.
//
// Comprueba todo ANTES de escribir nada: con un dato mal puesto, o una imagen
// de la marca que no sirve, el contenedor no arranca y deja la carpeta como
// estaba, en vez de servir media web. Sin --datos lee el fichero de la
// instalación (shared/datos-entidad.mjs: en las pruebas, el ejemplo); sin
// --marca, la carpeta de shared/marca.mjs (en las pruebas, solo la partida).
//
// Solo importa de shared/ y de node: el contenedor de nginx tiene Node, pero
// ninguna dependencia de la web. Las funciones las usan también el plugin de
// Vite (scripts/instalacion-vite.mjs) y las pruebas.

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import { leerDatosEntidad, rutaDeDatosEntidad } from '../../shared/datos-entidad.mjs'
import { resolverMarca, rutaDeMarca } from '../../shared/marca.mjs'

/** La URL de una imagen de la marca, con su versión; null si no hay fichero. */
export const urlDeMarca = (fichero) => (fichero ? `/marca/${fichero.fichero}?v=${fichero.version}` : null)

/**
 * Las imágenes que pinta la web, ya con su respaldo: sin escudo destacado, el
 * de sobre oscuro (la papeleta de la web va sobre negro); sin imagen de
 * compartir, el icono grande.
 */
export function imagenesDeMarca(ficheros) {
  return {
    escudo: urlDeMarca(ficheros.escudoSobreOscuro),
    escudoDestacado: urlDeMarca(ficheros.escudoDestacado ?? ficheros.escudoSobreOscuro),
    compartir: urlDeMarca(ficheros.compartir ?? ficheros.icono512),
  }
}

/**
 * Lo que la web recibe de la corporación: la identidad y la marca, campo a
 * campo. Se copian uno a uno y no con `...datos.identidad` para que un dato
 * nuevo del fichero no acabe publicado sin que nadie lo decida. Secretaría, la
 * sede, las redes y la privacidad no van: se cambian en el CMS y la web las
 * pide a la API (`GET /api/corporacion`), igual que los módulos.
 */
export function instalacionPublica({ identidad: i, marca: m }, ficheros) {
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
    marca: { colorPrincipal: m.colorPrincipal, colorAcento: m.colorAcento, imagenes: imagenesDeMarca(ficheros) },
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
export function rellenarIndex(plantilla, { identidad }, ficheros) {
  const url = `https://${identidad.dominio}`
  const valores = {
    nombre: identidad.nombre,
    titular: identidad.titular,
    localidad: identidad.localidad,
    descripcion: identidad.descripcion,
    url,
    denominacion: identidad.denominacion,
    favicon: urlDeMarca(ficheros.favicon32),
    appleTouch: urlDeMarca(ficheros.appleTouchIcon),
    // Absoluta: los robots que leen og:image no la resuelven contra la página.
    imagenCompartir: url + imagenesDeMarca(ficheros).compartir,
    // Con el icono cuadrado de respaldo, la tarjeta grande lo recortaría a
    // una franja: la pequeña lo enseña entero.
    tarjetaTwitter: ficheros.compartir ? 'summary_large_image' : 'summary',
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
  // Solo dentro del JSON-LD: en un <style> o en otro script esa coma puede
  // ser de quien escribió la plantilla, y no es asunto de esta orden.
  return lineas.join(salto).replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
    (_, abre, cuerpo, cierra) => abre + cuerpo.replace(/,(\s*\r?\n\s*[}\]])/g, '$1') + cierra,
  )
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

export const manifest = ({ identidad }, ficheros) => JSON.stringify({
  name: identidad.nombre,
  short_name: identidad.nombreCorto,
  lang: 'es',
  start_url: '/',
  scope: '/',
  // `standalone` y no `browser`: en el iPhone, los avisos para aprobar la
  // entrada al CMS solo llegan a una web añadida a la pantalla de inicio que
  // se abra como app. Para quien solo visita la web no cambia nada.
  display: 'standalone',
  background_color: '#070608',
  theme_color: '#070608',
  icons: [
    { src: urlDeMarca(ficheros.icono192), sizes: '192x192', type: 'image/png' },
    { src: urlDeMarca(ficheros.icono512), sizes: '512x512', type: 'image/png' },
    { src: urlDeMarca(ficheros.icono512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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

// Congelado hasta el fondo: nada de la web puede cambiar por accidente los
// datos que leen las demás piezas, y Object.freeze solo no llega a los objetos
// de dentro (identidad, marca, normas).
export const instalacionJs = (datos, ficheros) =>
  `window.__INSTALACION__=(function c(o){if(o&&typeof o==='object'){Object.values(o).forEach(c);Object.freeze(o)}return o})(${JSON.stringify(instalacionPublica(datos, ficheros))});\n`

/**
 * La marca de `carpeta` (null: solo la de partida), o un error con todo lo que
 * no sirve. Los avisos (lo que falta y se toma de la partida, medidas flojas)
 * se dicen y no paran: una corporación recién instalada aún no tiene escudo.
 */
export function leerMarcaDe(carpeta, avisar = (aviso) => console.warn(`[marca] ${aviso}`)) {
  const { ficheros, errores, avisos } = resolverMarca({ carpeta })
  if (errores.length) {
    const cuantos = errores.length === 1 ? 'un fichero que no sirve' : `${errores.length} ficheros que no sirven`
    throw new Error(`La marca (${carpeta}) tiene ${cuantos}:\n${errores.map((e) => `  - ${e}`).join('\n')}`)
  }
  for (const aviso of avisos) avisar(aviso)
  return ficheros
}

/**
 * Copia a <destino>/marca/ los ficheros que se usan, y nada más: la carpeta se
 * vacía antes para que un escudo quitado de la instalación no se siga sirviendo
 * del arranque anterior. Modo 0644 explícito: si el original llegó en 640 (como
 * datos-entidad.json en el servidor), copiarlo con su modo daría 403 al
 * usuario de nginx.
 */
export function copiarMarca(ficheros, destino) {
  const carpeta = join(destino, 'marca')
  rmSync(carpeta, { recursive: true, force: true })
  mkdirSync(carpeta, { recursive: true })
  const copiados = Object.values(ficheros).filter(Boolean)
  for (const fichero of copiados) {
    const ruta = join(carpeta, fichero.fichero)
    writeFileSync(ruta, readFileSync(fichero.ruta), { mode: 0o644 })
    // `mode` pasa por la umask del proceso: se fija después, sin ella.
    chmodSync(ruta, 0o644)
  }
  return copiados
}

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
      marca: { type: 'string' },
      comprimir: { type: 'boolean', default: false },
    },
  })
  if (!values.plantilla || !values.destino) {
    throw new Error('Uso: node instalacion-web.mjs --plantilla <index.html> --destino <carpeta> [--datos <json>] [--marca <carpeta>] [--comprimir]')
  }

  // Primero todo lo que puede fallar; después, y solo entonces, se escribe.
  const plantilla = readFileSync(resolve(values.plantilla), 'utf8')
  const problema = comprobarPlantilla(plantilla)
  if (problema) throw new Error(`${values.plantilla} ${problema}`)
  const datos = leerDatos(values.datos)
  const marca = leerMarcaDe(values.marca ? resolve(values.marca) : rutaDeMarca())
  const index = rellenarIndex(plantilla, datos, marca)
  const ficheros = [
    ['index.html', index],
    ['manifest.json', manifest(datos, marca)],
    ['robots.txt', robots(datos)],
    ['instalacion.js', instalacionJs(datos, marca)],
  ]
  // Node no escribe la hora en la cabecera del gzip: sale igual en cada arranque.
  if (values.comprimir) ficheros.push(['index.html.gz', gzipSync(index, { level: 9 })])

  const destino = resolve(values.destino)
  mkdirSync(destino, { recursive: true })
  for (const [nombre, contenido] of ficheros) writeFileSync(join(destino, nombre), contenido)
  console.log(`[instalacion-web] ${datos.identidad.nombre} (${datos.identidad.dominio}): ${ficheros.map(([n]) => n).join(', ')} en ${destino}.`)
  // Uno por fichero y diciendo de dónde sale: en `docker compose logs web` se
  // ve de un vistazo si se usa el escudo propio o el genérico.
  for (const f of copiarMarca(marca, destino)) {
    console.log(`[marca] ${f.fichero}: ${f.origen === 'instalacion' ? 'de la instalación' : 'de la marca de partida'}.`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    orden(process.argv.slice(2))
  } catch (error) {
    console.error(`[instalacion-web] ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
