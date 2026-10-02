import { describe, it, expect } from 'vitest'
import CATALOGO from '../../../../shared/modulos.json'
import { CLAVES_MODULO, cumple, fichaDeModulo } from '../modulos'

describe('el catálogo de módulos en la web', () => {
  it('las claves escritas aquí son las de shared/modulos.json, en el mismo orden', () => {
    expect([...CLAVES_MODULO]).toEqual(CATALOGO.modulos.map((m) => m.clave))
  })

  it('cumple: nucleo siempre; una clave, si está; una lista, con cualquiera', () => {
    const activos = new Set(['noticias', 'tienda'])
    expect(cumple('nucleo', activos)).toBe(true)
    expect(cumple('noticias', activos)).toBe(true)
    expect(cumple('agenda', activos)).toBe(false)
    expect(cumple(['inventario', 'tienda'], activos)).toBe(true)
    expect(cumple(['inventario', 'procesion'], activos)).toBe(false)
    expect(cumple('agenda', new Set())).toBe(false)
  })

  it('la ficha trae nombre y requisitos', () => {
    expect(fichaDeModulo('tienda-web').requiere).toEqual(['tienda', 'pago-en-linea'])
    expect(fichaDeModulo('puerta').nombre).toBe('Puerta del templo')
  })
})
