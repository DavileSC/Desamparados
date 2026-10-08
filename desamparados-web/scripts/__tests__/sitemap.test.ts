import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rutasDelBloquePublico, rutasParaElSitemap, urlsIndexables } from '../rutas-publicas.mjs'
import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs'

// El sitemap lo sirve la API (/sitemap.xml) con la lista de rutas públicas que
// genera `npm run sitemap` en shared/rutas-publicas.json. El fichero está
// versionado: si alguien añade una ruta y hace commit sin regenerarlo, la API
// anunciaría la lista vieja. Esta prueba lo detecta en CI antes de que Google
// lo vea (y la del backend, `test/sitemap.test.ts`, comprueba lo que sirve).

function rutasDelJson(): { ruta: string; requisito: string[] }[] {
  return JSON.parse(readFileSync(join(process.cwd(), '../shared/rutas-publicas.json'), 'utf8')).rutas
}

describe('shared/rutas-publicas.json', () => {
  it('lleva exactamente las rutas públicas del router, con su módulo', () => {
    expect(rutasDelJson(), 'ejecuta `npm run sitemap` para regenerarlo').toEqual(rutasParaElSitemap())
  })

  it('no lleva el área privada ni el CMS', () => {
    const privadas = ['/cms', '/area-hermano', '/acceso', '/reset-password']
    for (const { ruta } of rutasDelJson()) {
      for (const privada of privadas) {
        expect(ruta.startsWith(privada), `${ruta} no debería indexarse`).toBe(false)
      }
    }
  })

  it('el sitemap ya no es un fichero de la web: lo sirve la API', () => {
    expect(existsSync(join(process.cwd(), 'public/sitemap.xml'))).toBe(false)
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
    const sinTiendaWeb = urlsIndexables(leerDatosEntidad().modulos.activos.filter((c) => c !== 'tienda-web'))
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
