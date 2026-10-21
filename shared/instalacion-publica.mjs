// Lo que la web pública sabe de la corporación, en los tres ficheros que la
// web lee al cargar: /instalacion.js (`window.__INSTALACION__`, la identidad y
// la marca que pinta React), /manifest.json y la cabecera de index.html (título,
// iconos, Open Graph y JSON-LD: lo que leen WhatsApp, Facebook o Google sin
// ejecutar JavaScript).
//
// Los escribe la API (services/marca.service.ts) al arrancar y cada vez que
// Administración cambia el nombre, los colores o una imagen desde el CMS, en
// storage/public/instalacion/; nginx los sirve de ahí y mete la cabecera en
// index.html con SSI (docker/nginx/ubicaciones.conf). En `npm run dev`, el
// plugin de Vite (desamparados-web/scripts/instalacion-vite.mjs) toma los que
// haya escrito la API local, o los compone del fichero de la instalación con
// estas mismas funciones.
//
// Solo importa de node: lo carga también el contenedor de nginx, que no tiene
// dependencias.

import { chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolverMarca } from './marca.mjs'

/** La cabecera de index.html con sus marcas `{{…}}`: la rellena `cabeceraHtml`. */
export const PLANTILLA_CABECERA = join(dirname(fileURLToPath(import.meta.url)), 'cabecera.plantilla.html')

/**
 * Lo que index.html lleva donde va la cabecera: nginx lo cambia por
 * cabecera.html (SSI) y Vite, por la cabecera compuesta.
 */
export const INCLUSION_CABECERA = '<!--# include virtual="/_cabecera" -->'

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
      titulares: [...i.titulares],
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
    if (!(clave in valores)) throw new Error(`La plantilla usa {{${clave}}}, que no existe en shared/instalacion-publica.mjs.`)
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
  // ser de quien escribió la plantilla, y no es asunto de esta función.
  return lineas.join(salto).replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
    (_, abre, cuerpo, cierra) => abre + cuerpo.replace(/,(\s*\r?\n\s*[}\]])/g, '$1') + cierra,
  )
}

/** La cabecera de index.html de esta corporación, con la plantilla de shared/. */
export const cabeceraHtml = (datos, ficheros) => rellenarIndex(readFileSync(PLANTILLA_CABECERA, 'utf8'), datos, ficheros)

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
 * Escribe `contenido` en `ruta` sin que nadie lea nunca uno a medias: primero
 * al lado y después `rename`, que en el mismo disco es de una vez. Modo 0644
 * explícito: nginx lo lee con su propio usuario, y `mode` pasa por la umask.
 */
function escribirDeUnaVez(ruta, contenido) {
  const temporal = `${ruta}.${process.pid}.tmp`
  writeFileSync(temporal, contenido)
  chmodSync(temporal, 0o644)
  renameSync(temporal, ruta)
}

/**
 * Deja en <destino>/marca/ los ficheros que se usan, y nada más: uno que ya no
 * se usa (un escudo destacado quitado) se borra para que no se siga sirviendo.
 * Se sustituyen uno a uno y no vaciando la carpeta: mientras tanto la web sigue
 * pidiendo los de antes, y un hueco daría un 404 a quien esté cargando.
 */
export function copiarMarca(ficheros, destino) {
  const carpeta = join(destino, 'marca')
  mkdirSync(carpeta, { recursive: true })
  const copiados = Object.values(ficheros).filter(Boolean)
  for (const fichero of copiados) escribirDeUnaVez(join(carpeta, fichero.fichero), readFileSync(fichero.ruta))
  const usados = new Set(copiados.map((f) => f.fichero))
  for (const nombre of readdirSync(carpeta)) {
    if (!usados.has(nombre)) rmSync(join(carpeta, nombre), { recursive: true, force: true })
  }
  return copiados
}

/**
 * Los cuatro de la web en <destino>: instalacion/instalacion.js,
 * instalacion/manifest.json, instalacion/cabecera.html y marca/. `datos`: la
 * identidad (con el dominio) y los colores; `ficheros`, la marca resuelta.
 * Se compone todo antes de escribir nada: un dato que rompe una plantilla no
 * deja la web con la mitad nueva.
 */
export function publicarInstalacion(destino, datos, ficheros) {
  const textos = [
    ['instalacion.js', instalacionJs(datos, ficheros)],
    ['manifest.json', manifest(datos, ficheros)],
    ['cabecera.html', cabeceraHtml(datos, ficheros)],
  ]
  // Primero la marca: la cabecera nueva ya pide los iconos con su versión.
  copiarMarca(ficheros, destino)
  const carpeta = join(destino, 'instalacion')
  mkdirSync(carpeta, { recursive: true })
  for (const [nombre, contenido] of textos) escribirDeUnaVez(join(carpeta, nombre), contenido)
}
