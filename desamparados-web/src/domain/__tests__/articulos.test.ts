import { describe, it, expect } from 'vitest'
import {
  aArticulo, aLaCorporacion, conArticulo, deArticulo, deLaCorporacion, laCorporacion, mayuscula, nuestraCorporacion, nuestro, segunNumero, type Articulo,
} from '../articulos'
// Import del JSON, como el resto de la web (`config/site.ts`), en vez del
// `readFileSync` del backend: aquí lo resuelve Vite, no Node.
import casos from '../../../../shared/casos-articulos.json'

describe('artículos', () => {
  it('con, de y a, con sus contracciones', () => {
    for (const [art, nombre, esperado] of casos.con) expect(conArticulo(art as Articulo, nombre)).toBe(esperado)
    for (const [art, nombre, esperado] of casos.de) expect(deArticulo(art as Articulo, nombre)).toBe(esperado)
    for (const [art, nombre, esperado] of casos.a) expect(aArticulo(art as Articulo, nombre)).toBe(esperado)
  })
  it('el posesivo concuerda con el artículo', () => {
    for (const [art, esperado] of casos.nuestro) expect(nuestro(art as Articulo)).toBe(esperado)
  })
  it('el verbo concuerda en número: plural con «los» y «las»', () => {
    for (const [art, singular, plural, esperado] of casos.segunNumero) expect(segunNumero(art as Articulo, singular, plural)).toBe(esperado)
  })
  it('la mayúscula de comienzo de frase', () => {
    for (const [texto, esperado] of casos.mayuscula) expect(mayuscula(texto)).toBe(esperado)
  })
})

describe('la corporación', () => {
  const hermandad = { articulo: 'la' as const, tipo: 'Hermandad', tipoCorto: 'Hermandad' }
  it('la de esta instalación', () => {
    expect(laCorporacion()).toBe('el Grupo Parroquial')
    expect(deLaCorporacion()).toBe('del Grupo Parroquial')
    expect(deLaCorporacion({ corto: true })).toBe('del Grupo')
    expect(aLaCorporacion()).toBe('al Grupo Parroquial')
    expect(nuestraCorporacion()).toBe('nuestro Grupo Parroquial')
  })
  it('otra instalación', () => {
    expect(deLaCorporacion({ identidad: hermandad })).toBe('de la Hermandad')
    expect(nuestraCorporacion({ identidad: hermandad })).toBe('nuestra Hermandad')
    expect(mayuscula(laCorporacion({ identidad: hermandad }))).toBe('La Hermandad')
  })
})
