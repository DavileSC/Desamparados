import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs'

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
