import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// El sitemap se genera en `prebuild`, pero el fichero está versionado: si
// alguien añade una ruta y hace commit sin construir, se desincroniza otra vez.
// Esta prueba lo detecta en CI antes de que Google lo vea.

const raiz = process.cwd()
const DOMINIO = 'https://www.desamparadosmalaga.com'

function rutasPublicasDelRouter(): string[] {
  const fuente = readFileSync(join(raiz, 'src/routes/index.tsx'), 'utf8')
  const inicio = fuente.indexOf('<MarcoPublico />')
  const fin = fuente.indexOf("path: '*'", inicio)
  const bloque = fuente.slice(inicio, fin)

  const rutas = [...bloque.matchAll(/path:\s*'([^']+)'/g)]
    .map((m) => m[1])
    .filter((ruta) => !ruta.includes(':') && !ruta.includes('*'))

  return [...new Set(['/', ...rutas.map((r) => `/${r}`)])].sort()
}

function urlsDelSitemap(): string[] {
  const xml = readFileSync(join(raiz, 'public/sitemap.xml'), 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(DOMINIO, ''))
    .sort()
}

describe('sitemap.xml', () => {
  it('no anuncia ninguna URL que no exista como ruta', () => {
    const rutas = rutasPublicasDelRouter()
    const inexistentes = urlsDelSitemap().filter((url) => !rutas.includes(url))
    expect(inexistentes, 'darían 404 a los buscadores').toEqual([])
  })

  it('no se deja fuera ninguna página pública', () => {
    const sitemap = urlsDelSitemap()
    const ausentes = rutasPublicasDelRouter().filter((ruta) => !sitemap.includes(ruta))
    expect(ausentes, 'ejecuta `npm run sitemap` para regenerarlo').toEqual([])
  })

  it('no indexa el área privada ni el CMS', () => {
    const privadas = ['/cms', '/area-hermano', '/acceso', '/reset-password']
    for (const url of urlsDelSitemap()) {
      for (const privada of privadas) {
        expect(url.startsWith(privada), `${url} no debería indexarse`).toBe(false)
      }
    }
  })
})
