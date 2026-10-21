// Prepara las imágenes de la marca (shared/marca.mjs dice cuáles son y qué
// medidas piden). Tres usos:
//
//   npm run marca -- --partida
//       Rehace los PNG de shared/marca-de-partida/ desde su escudo.svg. Solo
//       cuando cambia el SVG; los PNG se versionan.
//
//   npm run marca -- --escudo <escudo.png> --destino instalacion/marca
//       Los cuatro iconos (favicon-32, apple-touch-icon, icono-192, icono-512)
//       de una instalación, a partir de su escudo para fondo oscuro.
//
//   npm run marca -- --optimizar <escudo.png> --destino instalacion/marca/escudo-sobre-oscuro.png
//       El escudo de la web reducido (176–300 px de alto) y en PNG de paleta:
//       va en todas las páginas, y el original de 141 KB las haría pesar.
//
// Las rutas relativas son desde donde se lanza la orden, aunque npm la ejecute
// dentro de desamparados-web/ (`npm --prefix desamparados-web run marca …`
// desde la raíz).
//
// Cómo se componen los iconos y por qué: shared/preparar-marca.mjs, que usa
// también la API al subir el escudo desde el CMS.
//
// `sharp` no es dependencia de la web —es una herramienta de una vez, y pesa—:
// se toma prestada del backend, que ya la usa para las fotos.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { ALTO_WEB, escudoQueCabe, iconosDeMarca } from '../../shared/preparar-marca.mjs'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(join(raiz, 'backend-desamparados/package.json'))
const sharp = require('sharp')

const PARTIDA = join(raiz, 'shared/marca-de-partida')
/** El casi negro del escudo de los correos y los PDF (`COLORES.negro` de la plantilla de correo). */
const NEGRO_ESCUDO = '#141111'

const { values: op } = parseArgs({
  options: {
    partida: { type: 'boolean' },
    escudo: { type: 'string' },
    optimizar: { type: 'string' },
    destino: { type: 'string' },
  },
})

/** Las rutas que da quien lanza la orden, desde su carpeta y no desde desamparados-web/. */
const desde = (ruta) => resolve(process.env.INIT_CWD ?? process.cwd(), ruta)

const kb = (ruta) => `${Math.round(statSync(ruta).size / 102.4) / 10} KB`

/**
 * El escudo del SVG de partida en un color y a un alto. Por debajo de ~100 px
 * el trazo de 6 (en un dibujo de 244 de alto) se quedaría en medio píxel y el
 * favicon saldría casi vacío: ahí se engorda el contorno hasta ~1,5 px y se
 * quita el filete, que no cabría.
 */
async function escudoDePartida(color, alto) {
  let svg = readFileSync(join(PARTIDA, 'escudo.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replaceAll('currentColor', color)
  if (alto < 100) {
    const grueso = Math.ceil((1.5 * 244) / alto)
    svg = svg
      .replace(/<path data-trazo="filete"[^>]*\/>/, '')
      .replace(/(data-trazo="contorno" stroke-width=")6"/, `$1${grueso}"`)
      .replace('viewBox="0 0 200 244"', `viewBox="${-grueso / 2} ${-grueso / 2} ${200 + grueso} ${244 + grueso}"`)
  }
  // Se rasteriza a cuatro veces el alto pedido y luego se reduce: el borde sale suave.
  const densidad = Math.ceil((72 * alto * 4) / 244)
  return sharp(Buffer.from(svg), { density: densidad }).resize({ height: alto }).png().toBuffer()
}

/** Los cuatro iconos en `carpeta`, con el escudo que da `escudo(alto)` centrado sobre la tinta. */
async function iconos(carpeta, escudo) {
  mkdirSync(carpeta, { recursive: true })
  for (const { fichero, lado, bytes } of await iconosDeMarca(sharp, escudo)) {
    const destino = join(carpeta, fichero)
    writeFileSync(destino, bytes)
    console.log(`· ${destino}: ${lado}×${lado}, ${kb(destino)}`)
  }
}

if (op.partida) {
  // PNG sin entrelazar (lo de sharp por defecto) y de paleta: pesan poco y se versionan.
  const escudos = [
    { fichero: 'escudo-sobre-oscuro.png', color: '#ffffff', alto: 240 },
    { fichero: 'escudo-sobre-claro.png', color: NEGRO_ESCUDO, alto: 300 },
  ]
  for (const { fichero, color, alto } of escudos) {
    const destino = join(PARTIDA, fichero)
    await sharp(await escudoDePartida(color, alto)).png({ palette: true, compressionLevel: 9 }).toFile(destino)
    console.log(`· ${destino}: alto ${alto}, ${kb(destino)}`)
  }
  await iconos(PARTIDA, (alto) => escudoDePartida('#ffffff', alto))
} else if (op.escudo) {
  if (!op.destino) throw new Error('Falta --destino <carpeta> (normalmente instalacion/marca).')
  const origen = desde(op.escudo)
  await iconos(desde(op.destino), escudoQueCabe(sharp, origen))
} else if (op.optimizar) {
  if (!op.destino) throw new Error('Falta --destino <fichero.png> (normalmente instalacion/marca/escudo-sobre-oscuro.png).')
  const origen = desde(op.optimizar)
  const destino = desde(op.destino)
  const { height } = await sharp(origen).metadata()
  if (height < ALTO_WEB.minimo) console.warn(`Ojo: el original mide ${height} px de alto, menos de los ${ALTO_WEB.minimo} recomendados; se verá borroso en pantallas 2x.`)
  mkdirSync(dirname(destino), { recursive: true })
  await sharp(origen)
    .resize({ height: Math.min(height, ALTO_WEB.maximo), withoutEnlargement: true })
    // Calidad 80: a 300 px no se distingue de 90 y baja de ~30 a ~25 KB (el escudo de Desamparados).
    .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 })
    .toFile(destino)
  const { width: ancho, height: alto } = await sharp(destino).metadata()
  console.log(`· ${destino}: ${ancho}×${alto}, ${kb(destino)} (el original, ${kb(origen)})`)
} else {
  console.error('Uso: npm run marca -- --partida | --escudo <png> --destino <carpeta> | --optimizar <png> --destino <png>')
  process.exit(1)
}
