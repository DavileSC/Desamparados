import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CARPETA_IMAGENES, MAPA_DEL_BARRIO, imagenDeLaInstalacion, mapaDelBarrio } from '../instalacion-vite.mjs'

// Las fotos de la instalación en `npm run dev` y `vite preview`: lo mismo que
// el `alias` de nginx al montaje (docker/nginx/ubicaciones.conf). Sobre una
// carpeta temporal: las de instalacion/imagenes de este PC no cuentan.

const carpeta = mkdtempSync(join(tmpdir(), 'instalacion-imagenes-'))
afterAll(() => rmSync(carpeta, { recursive: true, force: true }))
mkdirSync(join(carpeta, 'cabeceras'))
writeFileSync(join(carpeta, 'hero.webp'), 'webp')
writeFileSync(join(carpeta, 'cabeceras', 'cera-1000.webp'), 'cabecera')
writeFileSync(join(carpeta, 'notas.txt'), 'no es una foto')
writeFileSync(join(carpeta, '.oculta.png'), 'oculta')
writeFileSync(join(tmpdir(), 'fuera-de-la-carpeta.png'), 'fuera')

describe('las fotos de la instalación en Vite', () => {
  it('la carpeta es instalacion/imagenes, fuera de la web', () => {
    expect(CARPETA_IMAGENES.replace(/\\/g, '/')).toMatch(/\/instalacion\/imagenes\/?$/)
    expect(CARPETA_IMAGENES.replace(/\\/g, '/')).not.toContain('desamparados-web')
  })

  it('sirve las fotos de la carpeta y sus subcarpetas, con su tipo', () => {
    expect(imagenDeLaInstalacion('hero.webp', carpeta)).toMatchObject({ tipo: 'image/webp' })
    expect(imagenDeLaInstalacion('cabeceras/cera-1000.webp', carpeta)?.contenido.toString()).toBe('cabecera')
  })

  it.each([
    ['no-esta.webp', 'un fichero que no está'],
    ['notas.txt', 'lo que no es una foto'],
    ['.oculta.png', 'un fichero oculto'],
    ['cabeceras', 'una carpeta'],
    ['../fuera-de-la-carpeta.png', 'salir con «..»'],
    ['%2e%2e/fuera-de-la-carpeta.png', 'salir con «..» codificado'],
    ['cabeceras\\..\\..\\fuera-de-la-carpeta.png', 'salir con barras invertidas'],
    ['%E0%A4%A', 'una dirección mal codificada'],
  ])('%s: 404 (%s)', (ruta) => {
    expect(imagenDeLaInstalacion(ruta, carpeta)).toBeNull()
  })

  it('sin la carpeta, 404 y nada más: otra instalación no tiene por qué tener fotos', () => {
    expect(imagenDeLaInstalacion('hero.webp', join(carpeta, 'no-existe'))).toBeNull()
  })
})

describe('el mapa del barrio en Vite', () => {
  it('es instalacion/mapas/barrio.json, fuera de la web', () => {
    expect(MAPA_DEL_BARRIO.replace(/\\/g, '/')).toMatch(/\/instalacion\/mapas\/barrio\.json$/)
  })

  it('se sirve si está; si no, 404: otra instalación no tiene por qué tener barrio', () => {
    writeFileSync(join(carpeta, 'barrio.json'), '{"caja":[0,0,1,1]}')
    expect(mapaDelBarrio(join(carpeta, 'barrio.json'))?.toString()).toBe('{"caja":[0,0,1,1]}')
    expect(mapaDelBarrio(join(carpeta, 'no-esta.json'))).toBeNull()
    expect(mapaDelBarrio(carpeta)).toBeNull()
  })
})
