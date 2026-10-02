import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { datosEntidad, rutasDelBloquePublico, urlsIndexables } from '../rutas-publicas.mjs'

// El sitemap se genera en `prebuild`, pero el fichero está versionado: si
// alguien añade una ruta y hace commit sin construir, se desincroniza otra vez.
// Esta prueba lo detecta en CI antes de que Google lo vea.

const DOMINIO = `https://${datosEntidad().identidad.dominio}`

function urlsDelSitemap(): string[] {
  const xml = readFileSync(join(process.cwd(), 'public/sitemap.xml'), 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(DOMINIO, ''))
    .sort()
}

describe('sitemap.xml', () => {
  it('anuncia exactamente las páginas públicas indexables de esta instalación', () => {
    expect(urlsDelSitemap(), 'ejecuta `npm run sitemap` para regenerarlo').toEqual([...urlsIndexables()].sort())
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

describe('las páginas que van al sitemap', () => {
  it('cada ruta del bloque público trae el módulo que le exige el router', () => {
    const rutas = rutasDelBloquePublico()
    expect(rutas.find((r) => r.ruta === 'tienda')?.requisito).toEqual(['tienda-web'])
    expect(rutas.find((r) => r.ruta === 'contacto')?.requisito).toEqual(['nucleo'])
    expect(rutas.length).toBeGreaterThan(20)
  })

  it('una página de un módulo que la instalación no enciende se queda fuera: respondería «no encontrado»', () => {
    const sinTiendaWeb = urlsIndexables(datosEntidad().modulos.activos.filter((c) => c !== 'tienda-web'))
    expect(sinTiendaWeb).not.toContain('/tienda')
    expect(sinTiendaWeb).toContain('/contacto')
    expect(sinTiendaWeb).toContain('/')
    expect(urlsIndexables([])).not.toContain('/noticias')
    expect(urlsIndexables([])).toContain('/historia')
  })

  it('las rutas con parámetro y las redirecciones no se anuncian', () => {
    expect(urlsIndexables().some((u) => u.includes(':') || u.includes('*'))).toBe(false)
  })
})
