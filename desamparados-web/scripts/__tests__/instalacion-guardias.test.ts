import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs'
import { CATALOGO_MARCA } from '../../../shared/marca.mjs'

const raiz = process.cwd()
const { identidad } = leerDatosEntidad()

// Lo que no se ve al probar la orden: que nada vuelva a meter los datos de una
// corporación en la web compilada ni en el repositorio.
describe('la web no lleva dentro los datos de ninguna corporación', () => {
  const ficherosDe = (carpeta: string): string[] =>
    readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? ficherosDe(join(carpeta, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(carpeta, e.name)] : [])

  it('ningún fichero de src/ importa el antiguo módulo @instalacion/', () => {
    const conImport = ficherosDe(join(raiz, 'src')).filter((f) => /from\s+['"]@instalacion\//.test(readFileSync(f, 'utf8')) || /vi\.mock\(\s*['"]@instalacion\//.test(readFileSync(f, 'utf8')))
    expect(conImport).toEqual([])
  })

  it('el manifest y robots.txt no están en public/: los escribe la orden al arrancar', () => {
    // Si estuvieran, Vite los copiaría a dist/ con los datos de esta máquina.
    expect(existsSync(join(raiz, 'public/manifest.json'))).toBe(false)
    expect(existsSync(join(raiz, 'public/robots.txt'))).toBe(false)
  })

  it('public/ no trae la marca de nadie: el escudo y los iconos vienen de instalacion/marca', () => {
    // Vite copia public/ a dist/ tal cual: un escudo aquí iría en la imagen
    // de todas las corporaciones, y uno con el nombre de un icono de la raíz
    // taparía la 301 de nginx a /marca/.
    const enPublic = (ruta: string) => existsSync(join(raiz, 'public', ruta))
    for (const { fichero } of CATALOGO_MARCA) expect(enPublic(fichero), `public/${fichero}`).toBe(false)
    expect(enPublic('marca'), 'public/marca').toBe(false)
    expect(enPublic('favicon.ico'), 'public/favicon.ico').toBe(false)
  })

  it('public/ no trae las fotos de nadie: van en instalacion/imagenes, servidas en /images/', () => {
    // Vite copiaría public/images a dist/ y de ahí a la imagen de Docker de
    // todas las corporaciones; además taparía el `alias` de nginx al montaje.
    expect(existsSync(join(raiz, 'public/images'))).toBe(false)
  })

  it('public/mapas solo trae las fuentes genéricas: el barrio va en instalacion/mapas', () => {
    // El mapa del barrio es de una corporación (sus calles); las fuentes de
    // MapLibre sirven a todas.
    expect(readdirSync(join(raiz, 'public/mapas'))).toEqual(['fuentes'])
  })

  it('index.html carga /instalacion.js antes que el código de la web y solo trae marcas, no datos', () => {
    const html = readFileSync(join(raiz, 'index.html'), 'utf8')
    const script = html.indexOf('<script src="/instalacion.js"></script>')
    expect(script).toBeGreaterThan(-1)
    expect(script).toBeLessThan(html.search(/<script[^>]*type="module"/))
    expect(html).toContain('<title>{{nombre}} | {{localidad}}</title>')
    // Sin los comentarios, que explican el porqué y pueden nombrar al Grupo.
    const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '')
    for (const dato of [identidad.nombre, identidad.dominio, identidad.localidad, 'Desamparados', 'Málaga', 'desamparadosmalaga']) {
      expect(sinComentarios).not.toContain(dato)
    }
  })
})
