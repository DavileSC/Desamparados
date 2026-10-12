import { describe, it, expect } from 'vitest'
import CATALOGO from '../../../../shared/modulos.json'
import { CLAVES_DE_INSTALACION, CLAVES_MODULO, cumple, dependientesActivos, fichaDeModulo, nombreDeModulo } from '../modulos'

describe('el catálogo de módulos en la web', () => {
  it('las claves escritas aquí son las de shared/modulos.json, en el mismo orden', () => {
    expect([...CLAVES_MODULO]).toEqual(CATALOGO.modulos.map((m) => m.clave))
  })

  it('las de instalación, aparte: las del JSON, sin chocar con el catálogo, y con su nombre', () => {
    expect([...CLAVES_DE_INSTALACION]).toEqual(CATALOGO.deInstalacion.map((m) => m.clave))
    for (const c of CLAVES_DE_INSTALACION) expect(CLAVES_MODULO as readonly string[]).not.toContain(c)
    expect(nombreDeModulo('paginas-propias')).toBe('Páginas propias')
    expect(nombreDeModulo('tienda')).toBe('Tienda')
    expect(cumple('paginas-propias', new Set(CLAVES_MODULO))).toBe(false)
    expect(cumple('paginas-propias', new Set(['paginas-propias']))).toBe(true)
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

describe('dependientesActivos', () => {
  it('los encendidos que lo requieren, también los que lo requieren a través de otro, en el orden del catálogo', () => {
    const todos = new Set<string>(CLAVES_MODULO)
    expect(dependientesActivos('pago-en-linea', todos)).toEqual(['apadrinamientos', 'cuotas-en-linea', 'donativos', 'tienda-web'])
    expect(dependientesActivos('agenda', todos)).toEqual(['procesion', 'puerta'])
  })

  it('un dependiente apagado no cuenta, ni arrastra a los suyos', () => {
    expect(dependientesActivos('tienda', new Set(['tienda', 'pago-en-linea']))).toEqual([])
    // La Puerta requiere Procesión, que está apagada: no llega a la Agenda.
    expect(dependientesActivos('agenda', new Set(['agenda', 'puerta']))).toEqual([])
  })
})
