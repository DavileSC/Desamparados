import { describe, expect, it } from 'vitest'
import { slugDe } from '../slug'

describe('slugDe', () => {
  it('quita tildes, eñes y signos', () => {
    expect(slugDe('Sábado de Pasión')).toBe('sabado-de-pasion')
    expect(slugDe('  Rosario  vespertino! ')).toBe('rosario-vespertino')
    expect(slugDe('Año Jubilar')).toBe('ano-jubilar')
  })
})
