// Genera shared/rutas-publicas.json a partir del router: las páginas públicas
// que anuncia el sitemap, cada una con el módulo que exige.
//
// El sitemap ya no es un fichero de la web: lo sirve la API en /sitemap.xml
// (backend-desamparados/src/services/sitemap.service.ts), que sabe qué módulos
// están encendidos AHORA y qué noticias hay publicadas. Lo que la API no puede
// saber es qué páginas declara el router de la web, que vive aquí y no viaja
// en su imagen: por eso esta lista va a `shared/`, que leen los dos lados.
//
// Antes se mantenía a mano y se desincronizó: llegó a anunciar a Google tres
// URLs que ya no existían y a omitir siete páginas reales. Generarla desde las
// rutas declaradas impide que vuelva a pasar, y dos pruebas lo vigilan (la de
// `scripts/__tests__/sitemap.test.ts` y la del backend, `test/sitemap.test.ts`).
//
// Se ejecuta en `npm run build` (script `prebuild`) y con `npm run sitemap`.
// El fichero está versionado: tras cambiar una ruta pública, ejecutarlo y
// confirmar el JSON.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rutasParaElSitemap } from './rutas-publicas.mjs'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(raiz, '../shared/rutas-publicas.json')

// Por debajo de este número algo ha cambiado en el router y el recorte de
// rutas-publicas.mjs ya no encuentra el bloque público: mejor romper el build
// que dejar un sitemap truncado.
const MINIMO_ESPERADO = 20

const rutas = rutasParaElSitemap()

if (rutas.length < MINIMO_ESPERADO) {
  throw new Error(
    `Solo se han extraído ${rutas.length} rutas (se esperaban ${MINIMO_ESPERADO} o más). ` +
      'El router ha cambiado de forma: ajusta scripts/rutas-publicas.mjs.'
  )
}

const comentario =
  'Generado por desamparados-web/scripts/generar-sitemap.mjs desde el router. No editar a mano: ' +
  'tras cambiar una ruta pública, `npm run sitemap` en la web. La API lo usa para servir /sitemap.xml.'

// Una ruta por línea: el diff de un cambio en el router se lee de un vistazo.
const texto = [
  '{',
  `  "_comentario": ${JSON.stringify(comentario)},`,
  '  "rutas": [',
  rutas.map((r) => `    ${JSON.stringify(r).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`).join(',\n'),
  '  ]',
  '}',
  '',
].join('\n')

writeFileSync(DESTINO, texto, 'utf8')
console.log(`shared/rutas-publicas.json generado con ${rutas.length} rutas`)
