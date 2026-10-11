// Genera los iconos del sitio a partir del escudo del Grupo.
//
// Por qué hace falta generarlos: el único escudo que hay
// (`public/images/escudo-grupo.png`) es blanco sobre transparente, hecho para
// las barras oscuras. Como icono sería invisible en una pestaña clara o sobre
// el fondo blanco de la pantalla de inicio de un móvil. Aquí se compone sobre
// la tinta del sitio, que es el fondo que ya lleva detrás en la web.
//
// El favicon anterior (`favicon.svg`) era una forma morada y azul heredada de
// la plantilla con la que se arrancó el proyecto: no tenía nada que ver con el
// Grupo Parroquial.
//
// No se ejecuta en cada build: son ficheros de marca, se generan cuando cambia
// el escudo y se versionan. Para rehacerlos:
//
//   npm run iconos
//
// `sharp` no es dependencia de la web —es una herramienta de una vez, y pesa—:
// se toma prestada del backend, que ya la usa para quitar el EXIF de las fotos.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(raiz, '../backend-desamparados/package.json'))
const sharp = require('sharp')

/** La tinta del sitio: el mismo `#100e11` del velo de la barra. */
const TINTA = { r: 0x10, g: 0x0e, b: 0x11, alpha: 1 }

const ESCUDO = join(raiz, 'public/images/escudo-grupo.png')

/**
 * Cuánto del alto ocupa el escudo dentro del cuadrado. El resto es margen: los
 * iconos se ven pequeños y pegados al borde quedan apretados, y iOS además
 * recorta las esquinas para redondearlas.
 */
const PROPORCION = 0.66

/**
 * `apple-touch-icon.png` sin sufijo de tamaño a propósito: iOS lo busca por ese
 * nombre exacto en la raíz cuando la página no lo declara.
 */
const ICONOS = [
  { fichero: 'favicon-32.png', lado: 32 },
  { fichero: 'apple-touch-icon.png', lado: 180 },
  { fichero: 'icono-192.png', lado: 192 },
  { fichero: 'icono-512.png', lado: 512 },
]

for (const { fichero, lado } of ICONOS) {
  const alto = Math.round(lado * PROPORCION)
  const escudo = await sharp(ESCUDO).resize({ height: alto, fit: 'contain' }).toBuffer()
  await sharp({ create: { width: lado, height: lado, channels: 4, background: TINTA } })
    .composite([{ input: escudo, gravity: 'center' }])
    .png()
    .toFile(join(raiz, 'public', fichero))
  console.log(`· ${fichero}: ${lado}×${lado}`)
}

console.log('Listo. Recuerda que index.html y manifest.json los declaran.')
