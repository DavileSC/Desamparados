// Genera public/sitemap.xml a partir del router.
//
// El sitemap se mantenía a mano y se desincronizó: llegó a anunciar a Google
// tres URLs que ya no existían (/titular/…, renombradas a /sagrada-titular/…) y
// a omitir siete páginas reales. Generarlo desde la única fuente de verdad —las
// rutas declaradas— impide que vuelva a pasar.
//
// Se ejecuta solo en `npm run build` (script `prebuild`).

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const RUTAS = join(raiz, 'src/routes/index.tsx')
const SITEMAP = join(raiz, 'public/sitemap.xml')
const DOMINIO = 'https://www.desamparadosmalaga.com'

// Por debajo de este número algo ha cambiado en el router y el recorte de abajo
// ya no encuentra el bloque público: mejor romper el build que publicar un
// sitemap truncado.
const MINIMO_ESPERADO = 20

const fuente = readFileSync(RUTAS, 'utf8')

// El bloque público es el que cuelga de <PublicLayout /> y termina en su
// comodín `path: '*'`. Las demás secciones (acceso, área de hermanos, CMS) no
// deben indexarse.
const inicio = fuente.indexOf('<PublicLayout />')
if (inicio === -1) {
  throw new Error('No se encuentra <PublicLayout /> en src/routes/index.tsx: revisa este script.')
}
const fin = fuente.indexOf("path: '*'", inicio)
if (fin === -1) {
  throw new Error('No se encuentra el comodín del bloque público: revisa este script.')
}

const bloque = fuente.slice(inicio, fin)
const rutas = [...bloque.matchAll(/path:\s*'([^']+)'/g)]
  .map((m) => m[1])
  // Las rutas con parámetro (`:slug`) son contenido dinámico: sus URLs reales
  // dependen de la base de datos y no se pueden enumerar desde aquí.
  .filter((ruta) => !ruta.includes(':') && ruta !== '*')

const urls = ['/', ...rutas.map((r) => `/${r}`)]
const unicas = [...new Set(urls)].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)))

if (unicas.length < MINIMO_ESPERADO) {
  throw new Error(
    `Solo se han extraído ${unicas.length} rutas (se esperaban ${MINIMO_ESPERADO} o más). ` +
      'El router ha cambiado de forma: ajusta scripts/generar-sitemap.mjs.'
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
