// Genera public/sitemap.xml a partir del router.
//
// El sitemap se mantenía a mano y se desincronizó: llegó a anunciar a Google
// tres URLs que ya no existían (/titular/…, renombradas a /sagrada-titular/…) y
// a omitir siete páginas reales. Generarlo desde la única fuente de verdad —las
// rutas declaradas— impide que vuelva a pasar. Qué rutas entran y cuáles no
// (parámetros, redirecciones, módulos que esta instalación no enciende) lo
// decide `rutas-publicas.mjs`, el mismo que usa la prueba.
//
// Se ejecuta solo en `npm run build` (script `prebuild`).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { datosEntidad, urlsIndexables } from './rutas-publicas.mjs'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITEMAP = join(raiz, 'public/sitemap.xml')
// El dominio es el de la corporación: sale del fichero que comparten la API y la web.
const DOMINIO = `https://${datosEntidad().identidad.dominio}`

// Por debajo de este número algo ha cambiado en el router y el recorte de
// rutas-publicas.mjs ya no encuentra el bloque público: mejor romper el build
// que publicar un sitemap truncado. Las páginas del núcleo, que ninguna
// instalación apaga, son 19: una instalación con todos los módulos apagados
// tiene que pasar igual.
const MINIMO_ESPERADO = 15

const unicas = urlsIndexables()

if (unicas.length < MINIMO_ESPERADO) {
  throw new Error(
    `Solo se han extraído ${unicas.length} rutas (se esperaban ${MINIMO_ESPERADO} o más). ` +
      'El router ha cambiado de forma: ajusta scripts/rutas-publicas.mjs.'
  )
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Generado por scripts/generar-sitemap.mjs. No editar a mano. -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...unicas.map((ruta) => `  <url><loc>${DOMINIO}${ruta}</loc></url>`),
  '</urlset>',
  '',
].join('\n')

writeFileSync(SITEMAP, xml, 'utf8')
console.log(`sitemap.xml generado con ${unicas.length} URLs`)
