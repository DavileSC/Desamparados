import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs'
import { CATALOGO_MARCA } from '../../../shared/marca.mjs'
import { INCLUSION_CABECERA, PLANTILLA_CABECERA } from '../../../shared/instalacion-publica.mjs'

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

  it('src/ solo importa tipos de los módulos de shared/ que leen el disco: en el navegador no cargan', () => {
    // Las pruebas corren en Node y ahí sí cargan: un import de valor solo se
    // ve al abrir la pantalla («Algo ha fallado en esta página», 21-10-2026).
    const deNode = /shared\/(?:datos-entidad|marca|instalacion-publica|preparar-marca)\.mjs$/
    // Cada `import … from '…'` por separado (el `?` lo corta en el primer
    // `from`), también los de varias líneas.
    const importaValor = (texto: string) => [...texto.matchAll(/^import\s([\s\S]*?)\sfrom\s+['"]([^'"]+)['"]/gm)]
      .some(([, que, de]) => deNode.test(de) && !/^type\s/.test(que.trim()))
    const conValor = ficherosDe(join(raiz, 'src'))
      .filter((f) => !/[\\/](?:__tests__|test)[\\/]/.test(f))
      .filter((f) => importaValor(readFileSync(f, 'utf8')))
    expect(conValor).toEqual([])
  })

  it('el manifest y robots.txt no están en public/: los escriben la API y la orden del arranque', () => {
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

  it('index.html carga /instalacion.js antes que el código de la web y deja la cabecera a nginx', () => {
    const html = readFileSync(join(raiz, 'index.html'), 'utf8')
    const script = html.indexOf('<script src="/instalacion.js"></script>')
    expect(script).toBeGreaterThan(-1)
    expect(script).toBeLessThan(html.search(/<script[^>]*type="module"/))
    expect(html).toContain(INCLUSION_CABECERA)
    // El título y los iconos van en la cabecera: escritos aquí, saldrían dos veces.
    expect(html).not.toMatch(/<title>|rel="icon"|\{\{/)
  })

  it('ni index.html ni la plantilla de la cabecera traen datos, solo marcas', () => {
    const cabecera = readFileSync(PLANTILLA_CABECERA, 'utf8')
    expect(cabecera).toContain('<title>{{nombre}} | {{localidad}}</title>')
    for (const html of [readFileSync(join(raiz, 'index.html'), 'utf8'), cabecera]) {
      // Sin los comentarios, que explican el porqué y pueden nombrar al Grupo.
      const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '')
      for (const dato of [identidad.nombre, identidad.dominio, identidad.localidad, 'Desamparados', 'Málaga', 'desamparadosmalaga']) {
        expect(sinComentarios).not.toContain(dato)
      }
    }
  })
})
