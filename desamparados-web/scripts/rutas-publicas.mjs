// Las páginas públicas que se anuncian a los buscadores, leídas del router y
// recortadas por los módulos con los que arranca esta instalación. Lo usan
// `generar-sitemap.mjs` y su prueba, para que los dos recorten igual.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

/** El fichero que comparten la API y la web: el dominio y el lote inicial de módulos. */
export function datosEntidad() {
  return JSON.parse(readFileSync(join(raiz, '../shared/datos-entidad.json'), 'utf8'))
}

/**
 * Las rutas del bloque público de `src/routes/index.tsx`, cada una con su
 * requisito de módulo. El bloque es el que cuelga de <MarcoPublico /> y
 * termina en su comodín `path: '*'`; las demás secciones (acceso, área de
 * hermanos, CMS) no se indexan. Cada ruta va en una sola línea (la guardiana
 * de módulos del backend lo exige), así que se lee línea a línea: el
 * requisito es el segundo argumento de `pagina(...)`, y una ruta sin
 * `pagina` (una redirección) cuenta como del núcleo.
 */
export function rutasDelBloquePublico() {
  const fuente = readFileSync(join(raiz, 'src/routes/index.tsx'), 'utf8')
  const inicio = fuente.indexOf('<MarcoPublico />')
  if (inicio === -1) {
    throw new Error('No se encuentra <MarcoPublico /> en src/routes/index.tsx: revisa scripts/rutas-publicas.mjs.')
  }
  const fin = fuente.indexOf("path: '*'", inicio)
  if (fin === -1) {
    throw new Error('No se encuentra el comodín del bloque público: revisa scripts/rutas-publicas.mjs.')
  }
  return fuente.slice(inicio, fin).split('\n').flatMap((linea) => {
    const ruta = /path:\s*'([^']+)'/.exec(linea)
    if (!ruta) return []
    const modulo = /pagina\(\w+,\s*(?:'([^']+)'|\[([^\]]*)\])\)/.exec(linea)
    const requisito = !modulo ? ['nucleo'] : modulo[1] ? [modulo[1]] : [...modulo[2].matchAll(/'([^']+)'/g)].map((m) => m[1])
    return [{ ruta: ruta[1], requisito }]
  })
}

/**
 * Las URL que van al sitemap, ordenadas y sin repetir: la portada y las rutas
 * sin parámetro (`:slug` depende de la base de datos y no se puede enumerar
 * desde aquí), sin las que solo redirigen (`/*`) y sin las de módulos que
 * esta instalación no enciende: su página responde «no encontrado», y
 * anunciarla sería anunciar un 404. El lote es el de `datos-entidad.json`
 * salvo que se pase otro (las pruebas).
 */
export function urlsIndexables(activos = datosEntidad().modulos.activos) {
  const encendidos = new Set(activos)
  const cumple = (requisito) => requisito.some((m) => m === 'nucleo' || encendidos.has(m))
  const rutas = rutasDelBloquePublico()
    .filter(({ ruta, requisito }) => !ruta.includes(':') && !ruta.includes('*') && cumple(requisito))
    .map(({ ruta }) => `/${ruta}`)
  return [...new Set(['/', ...rutas])].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)))
}
