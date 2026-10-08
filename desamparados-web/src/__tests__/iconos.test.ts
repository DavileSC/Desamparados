import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { identidadGenerada } from '../test/identidadGenerada'

/**
 * Los iconos se declaran en dos sitios (`index.html` y `manifest.json`) y viven
 * en un tercero (`public/`). Un icono que no existe no rompe nada: el navegador
 * pide el fichero, recibe la página de inicio, no la entiende y enseña el
 * icono por defecto. Se ve en la pestaña, no en los tests. De ahí esto.
 */
const raiz = process.cwd()
const generada = identidadGenerada()
const html = generada.html
const manifiesto = JSON.parse(generada.manifiesto) as {
  theme_color: string
  icons: { src: string }[]
}

const existeEnPublic = (ruta: string) => existsSync(join(raiz, 'public', ruta.replace(/^\//, '')))

const atributo = (patron: RegExp) => patron.exec(html)?.[1]

describe('los iconos del sitio', () => {
  it('index.html declara el favicon, el de iOS, el manifiesto y el color', () => {
    expect(atributo(/<link rel="icon"[^>]*href="([^"]+)"/)).toBeDefined()
    expect(atributo(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/)).toBeDefined()
    expect(atributo(/<link rel="manifest"[^>]*href="([^"]+)"/)).toBe('/manifest.json')
    expect(atributo(/<meta name="theme-color" content="([^"]+)"/)).toBeDefined()
  })

  it('todos los ficheros que declara index.html están en public/', () => {
    for (const patron of [/<link rel="icon"[^>]*href="([^"]+)"/, /<link rel="apple-touch-icon"[^>]*href="([^"]+)"/]) {
      const ruta = atributo(patron)!
      expect(existeEnPublic(ruta), `falta ${ruta}`).toBe(true)
    }
  })

  it('todos los iconos del manifiesto están en public/', () => {
    for (const { src } of manifiesto.icons) {
      expect(existeEnPublic(src), `falta ${src}`).toBe(true)
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
