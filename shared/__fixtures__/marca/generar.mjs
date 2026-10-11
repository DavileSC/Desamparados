// Genera las imágenes de prueba de la marca. Se versionan (son unos pocos KB);
// esto queda para rehacerlas o añadir una:
//
//   node shared/__fixtures__/marca/generar.mjs
//
// completa/: una instalación con los nueve ficheros, todos válidos y sin
//   avisos, en azul para distinguirlos a simple vista de la marca de partida.
//   El escudo destacado va ENTRELAZADO (Adam7): PDFKit lo lee, y así lo
//   comprueban también las pruebas que generan PDF con esta carpeta.
// sueltos/: casos para las cabeceras y los errores del validador.
//
// `sharp` se toma prestada del backend, como en desamparados-web/scripts/preparar-marca.mjs.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const aqui = dirname(fileURLToPath(import.meta.url))
const sharp = createRequire(join(aqui, '../../../backend-desamparados/package.json'))('sharp')

const AZUL = '#1f4e79'
const escudo = (ancho, alto, color) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><ellipse cx="${ancho / 2}" cy="${alto / 2}" rx="${ancho / 2 - 2}" ry="${alto / 2 - 2}" fill="${color}"/></svg>`,
)
const liso = (ancho, alto, color, canales = 3) => sharp({ create: { width: ancho, height: alto, channels: canales, background: color } })

const completa = join(aqui, 'completa')
const sueltos = join(aqui, 'sueltos')
mkdirSync(completa, { recursive: true })
mkdirSync(sueltos, { recursive: true })

await sharp(escudo(144, 176, '#ffffff')).png().toFile(join(completa, 'escudo-sobre-oscuro.png'))
await sharp(escudo(200, 240, AZUL)).png().toFile(join(completa, 'escudo-sobre-claro.png'))
await sharp(escudo(200, 240, '#c0a040')).png({ progressive: true }).toFile(join(completa, 'escudo-destacado.png'))
for (const [fichero, lado] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icono-192.png', 192], ['icono-512.png', 512]]) {
  await liso(lado, lado, AZUL).png().toFile(join(completa, fichero))
}
await liso(1200, 630, AZUL).jpeg({ quality: 70 }).toFile(join(completa, 'compartir.jpg'))
await liso(1200, 300, AZUL).jpeg({ quality: 70 }).toFile(join(completa, 'correo-cabecera.jpg'))

// Un degradado diminuto en RGB sin alfa y entrelazado: el caso en que PDFKit
// tiene que desentrelazar él mismo (con alfa, ya decodifica siempre).
const degradado = Buffer.alloc(8 * 6 * 3)
for (let i = 0; i < 8 * 6; i++) degradado.set([i * 5, 255 - i * 5, (i * 37) % 256], i * 3)
await sharp(degradado, { raw: { width: 8, height: 6, channels: 3 } }).png({ progressive: true }).toFile(join(sueltos, 'rgb-entrelazado.png'))
await sharp(escudo(40, 48, AZUL)).png({ palette: true }).toFile(join(sueltos, 'paleta-con-trns.png'))
await liso(40, 48, AZUL).png().toFile(join(sueltos, 'opaco.png'))
await liso(64, 32, AZUL).jpeg({ progressive: true }).toFile(join(sueltos, 'progresivo.jpg'))
await liso(64, 32, AZUL).jpeg().toFile(join(sueltos, 'jpeg-con-extension.png'))
await liso(40, 48, AZUL, 4).webp().toFile(join(sueltos, 'escudo.webp'))
writeFileSync(join(sueltos, 'texto.png'), 'Esto no es una imagen: es lo que queda al guardar con > un fichero de texto.\n')
const entero = readFileSync(join(sueltos, 'opaco.png'))
writeFileSync(join(sueltos, 'cortado.png'), entero.subarray(0, entero.length - 20))
const jpeg = readFileSync(join(sueltos, 'progresivo.jpg'))
writeFileSync(join(sueltos, 'cortado.jpg'), jpeg.subarray(0, Math.floor(jpeg.length * 0.7)))

console.log('Listo.')
