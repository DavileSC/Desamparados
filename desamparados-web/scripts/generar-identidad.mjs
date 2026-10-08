// Escribe los ficheros de la web que dicen quién es la corporación y que no
// pasan por React: index.html (lo que leen WhatsApp, Facebook o Google sin
// ejecutar JavaScript), public/manifest.json y public/robots.txt.
//
// Salen de instalacion/datos-entidad.json, el mismo fichero que leen la API y
// src/config/site.ts: montar la web para otra corporación es cambiar ese
// fichero, no buscar su nombre por el código. index.html sale de
// index.plantilla.html; se edita la plantilla, nunca index.html.
//
// Los tres son de cada instalación, como su fichero de datos, y por eso no
// están en git: se escriben antes de `npm run dev` y de `npm run build`
// (predev y prebuild). Con `--destino <carpeta>` se escriben allí y no en la
// web (las pruebas).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { leerDatosEntidad } from '../../shared/datos-entidad.mjs'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const { identidad, secretaria, sede } = leerDatosEntidad()

const url = `https://${identidad.dominio}`
const valores = {
  nombre: identidad.nombre,
  titular: identidad.titular,
  localidad: identidad.localidad,
  descripcion: identidad.descripcion,
  url,
  email: secretaria.email,
  telefono: secretaria.telefono,
  denominacion: identidad.denominacion,
  sedeNombre: sede.nombre,
  sedeCalle: sede.calle,
  sedeCodigoPostal: sede.codigoPostal,
  sedeLocalidad: sede.localidad,
}

const html = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const json = (v) => JSON.stringify(String(v)).slice(1, -1).replace(/</g, '\\u003c')

function indexHtml() {
  const plantilla = readFileSync(join(raiz, 'index.plantilla.html'), 'utf8')
  const salto = plantilla.includes('\r\n') ? '\r\n' : '\n'
  const lineas = plantilla.split(/\r?\n/)
    // Un dato pendiente (null) no se inventa: su línea del JSON-LD desaparece.
    .filter((linea) => ![...linea.matchAll(/\{\{json:(\w+)\}\}/g)].some(([, clave]) => valores[clave] == null))
    .map((linea) => linea
      .replace(/\{\{json:(\w+)\}\}/g, (_, clave) => json(valor(clave)))
      .replace(/\{\{(\w+)\}\}/g, (_, clave) => html(valor(clave))))
  // Sin cerrar con una coma colgando si la última propiedad era la quitada.
  const texto = lineas.join(salto).replace(/,(\s*\r?\n\s*[}\]])/g, '$1')
  return texto.replace('<head>', `<head>${salto}    <!-- Generado desde index.plantilla.html por scripts/generar-identidad.mjs: no se edita a mano. -->`)
}

function valor(clave) {
  if (!(clave in valores)) throw new Error(`index.plantilla.html usa {{${clave}}}, que no existe en scripts/generar-identidad.mjs.`)
  return valores[clave]
}

const manifest = () => JSON.stringify({
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

const robots = () => [
  'User-agent: *',
  'Disallow: /cms',
  'Disallow: /area-hermano',
  'Disallow: /acceso',
  'Disallow: /reset-password',
  // Llevan en la dirección la clave de un pedido o de un pago: son de quien
  // pagó, no de un buscador.
  'Disallow: /tienda/pedido/',
  'Disallow: /apadrina/gracias/',
  `Sitemap: ${url}/sitemap.xml`,
  '',
].join('\n')

const ficheros = [
  ['index.html', indexHtml()],
  ['public/manifest.json', manifest()],
  ['public/robots.txt', robots()],
]

const posicion = process.argv.indexOf('--destino')
const destino = posicion === -1 ? raiz : resolve(process.argv[posicion + 1] ?? '')
for (const [ruta, contenido] of ficheros) {
  mkdirSync(dirname(join(destino, ruta)), { recursive: true })
  writeFileSync(join(destino, ruta), contenido)
}
