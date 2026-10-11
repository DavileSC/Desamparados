import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOGO_MARCA } from '../../../shared/marca.mjs'
import { identidadGenerada } from '../test/identidadGenerada'
import { MARCA_DE_PARTIDA } from '../test/instalacion'

/**
 * Los iconos se declaran en dos sitios (`index.html` y `manifest.json`) y viven
 * en un tercero: la marca de la instalación, que la orden de arranque copia a
 * /marca/ (en las pruebas, la de partida). Un icono que no existe no rompe
 * nada: el navegador pide el fichero, recibe un 404, y enseña el icono por
 * defecto. Se ve en la pestaña, no en los tests. De ahí esto.
 */
const raiz = process.cwd()
const generada = identidadGenerada()
const html = generada.html
const manifiesto = JSON.parse(generada.manifiesto) as {
  theme_color: string
  icons: { src: string; sizes: string }[]
}

const atributo = (patron: RegExp) => patron.exec(html)?.[1]

/** El fichero de la marca que nombra una URL /marca/<fichero>?v=<versión>, comprobando que la versión es la de su contenido. */
function ficheroDe(url: string) {
  const partes = /^\/marca\/([^?]+)\?v=([0-9a-f]{8})$/.exec(url)
  expect(partes, `${url} no es una URL de la marca con versión`).not.toBeNull()
  const [, nombre, version] = partes!
  const fichero = Object.values(MARCA_DE_PARTIDA).find((f) => f?.fichero === nombre)
  expect(fichero, `${nombre} no está en la marca resuelta`).toBeDefined()
  expect(existsSync(fichero!.ruta), `falta ${fichero!.ruta}`).toBe(true)
  expect(createHash('sha256').update(readFileSync(fichero!.ruta)).digest('hex').slice(0, 8)).toBe(version)
  return fichero!
}

describe('los iconos del sitio', () => {
  it('index.html declara el favicon, el de iOS, el manifiesto y el color', () => {
    expect(atributo(/<link rel="icon"[^>]*href="([^"]+)"/)).toBeDefined()
    expect(atributo(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/)).toBeDefined()
    expect(atributo(/<link rel="manifest"[^>]*href="([^"]+)"/)).toBe('/manifest.json')
    expect(atributo(/<meta name="theme-color" content="([^"]+)"/)).toBeDefined()
  })

  it('los iconos que declara index.html son los de la marca, con su medida', () => {
    expect(ficheroDe(atributo(/<link rel="icon"[^>]*href="([^"]+)"/)!)).toMatchObject({ fichero: 'favicon-32.png', ancho: 32, alto: 32 })
    expect(ficheroDe(atributo(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/)!)).toMatchObject({ fichero: 'apple-touch-icon.png', ancho: 180, alto: 180 })
  })

  it('los iconos del manifiesto son los de la marca y miden lo que dicen', () => {
    expect(manifiesto.icons.length).toBeGreaterThan(0)
    for (const { src, sizes } of manifiesto.icons) {
      const { ancho, alto } = ficheroDe(src)
      expect(`${ancho}x${alto}`).toBe(sizes)
    }
  })

  it('la marca de partida trae todos los iconos del catálogo', () => {
    // Si faltara uno, una corporación sin marca propia se quedaría sin él.
    for (const entrada of CATALOGO_MARCA.filter((e) => e.partida)) {
      expect(MARCA_DE_PARTIDA[entrada.clave], entrada.fichero).not.toBeNull()
    }
  })

  it('el color del manifiesto y el de index.html son el mismo', () => {
    // Si se separan, la barra del navegador en Android cambia de color según
    // se entre por la web o por el acceso directo guardado.
    expect(manifiesto.theme_color).toBe(atributo(/<meta name="theme-color" content="([^"]+)"/))
  })

  it('ya no se declara el favicon de la plantilla', () => {
    // Era una forma morada y azul que no tenía nada que ver con el Grupo.
    expect(html).not.toContain('favicon.svg')
    expect(existsSync(join(raiz, 'public/favicon.svg'))).toBe(false)
  })
})
