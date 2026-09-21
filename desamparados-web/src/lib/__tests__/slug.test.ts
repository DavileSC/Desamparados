import { describe, expect, it } from 'vitest'
import { direccionAutomatica, slugDeNoticia } from '../slug'
import casos from '../../../../shared/casos-slug.json'

/**
 * La misma tabla que lee `backend-desamparados/test/slug-paridad.test.ts`. El
 * CMS enseña la dirección mientras se escribe el título y el servidor la pone
 * al guardar: si se separan, la noticia acaba en una dirección distinta de la
 * que se prometió, y solo se descubre al compartir el enlace.
 */
describe('la dirección de una noticia', () => {
  it.each(casos.casos)('«$titulo» ($anio) → $slug', ({ titulo, anio, slug }) => {
    expect(slugDeNoticia(titulo, anio)).toBe(slug)
  })

  it('sin letras ni cifras en el título, el CMS no propone dirección', () => {
    // El servidor sí devolvería «-2026», pero eso no se le enseña a nadie: sin
    // título no se puede guardar, así que no hay dirección que prometer.
    expect(direccionAutomatica('¿?', '2026-03-14')).toBe('')
    expect(direccionAutomatica('', '2026-03-14')).toBe('')
  })

  it('el año sale de la fecha de la noticia', () => {
    expect(direccionAutomatica('Triduo a la Virgen', '2025-11-08')).toBe('triduo-a-la-virgen-2025')
  })
})
