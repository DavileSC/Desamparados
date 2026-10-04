import { describe, it, expect } from 'vitest'
import type { Producto } from '../../../lib/api/tienda'
import { SIN_FILTROS, cuantosFiltros, enTramo, filtrar, hayFiltros, ordenar, tallasDeLaTienda } from '../filtros'

const producto = (id: number, precio: number, extra: Partial<Producto> = {}): Producto => ({
  id, nombre: `P${id}`, descripcion: '', precio, foto: null, fotos: [], existencias: null, activo: true, orden: id, tallas: [],
  categoriaId: null, destacado: false, creadoEl: `2026-10-0${id}T10:00:00.000Z`, ...extra,
})

describe('filtros de la tienda', () => {
  it('cada tramo de precio incluye su tope', () => {
    expect(enTramo(5, 'hasta5')).toBe(true)
    expect(enTramo(5, '5a15')).toBe(false)
    expect(enTramo(5.01, '5a15')).toBe(true)
    expect(enTramo(30, '15a30')).toBe(true)
    expect(enTramo(30.5, 'mas30')).toBe(true)
  })

  it('los tramos y las tallas aceptan cualquiera de los marcados; los filtros entre sí, todos', () => {
    const lista = [
      producto(1, 3, { categoriaId: 7 }),
      producto(2, 12, { categoriaId: 7, tallas: [{ id: 1, nombre: 'M', existencias: 0 }, { id: 2, nombre: 'L', existencias: 4 }] }),
      producto(3, 40, { existencias: 0 }),
    ]
    expect(filtrar(lista, { ...SIN_FILTROS, tramos: ['hasta5', 'mas30'] }).map((p) => p.id)).toEqual([1, 3])
    expect(filtrar(lista, { ...SIN_FILTROS, categoria: 7, tramos: ['mas30'] })).toEqual([])
    // La M de la camiseta está agotada: buscando la M no sale; buscando la L, sí.
    expect(filtrar(lista, { ...SIN_FILTROS, tallas: ['M'] })).toEqual([])
    expect(filtrar(lista, { ...SIN_FILTROS, tallas: ['M', 'L'] }).map((p) => p.id)).toEqual([2])
    expect(filtrar(lista, { ...SIN_FILTROS, sinAgotados: true }).map((p) => p.id)).toEqual([1, 2])
  })

  it('ordena sin tocar la lista que recibe; «Destacados» deja el orden del CMS', () => {
    const lista = [producto(2, 12), producto(1, 3), producto(3, 40)]
    expect(ordenar(lista, 'destacados').map((p) => p.id)).toEqual([2, 1, 3])
    expect(ordenar(lista, 'barato').map((p) => p.id)).toEqual([1, 2, 3])
    expect(ordenar(lista, 'caro').map((p) => p.id)).toEqual([3, 2, 1])
    expect(ordenar(lista, 'recientes').map((p) => p.id)).toEqual([3, 2, 1])
    expect(lista.map((p) => p.id)).toEqual([2, 1, 3])
  })

  it('las tallas de la tienda, sin repetir y en el orden en que aparecen', () => {
    const t = (nombre: string) => ({ id: 0, nombre, existencias: null })
    expect(tallasDeLaTienda([producto(1, 1, { tallas: [t('S'), t('M')] }), producto(2, 1, { tallas: [t('M'), t('XL')] })])).toEqual(['S', 'M', 'XL'])
    expect(tallasDeLaTienda([producto(1, 1)])).toEqual([])
  })

  it('la categoría cuenta como filtro puesto, pero no en el número de la barra', () => {
    expect(hayFiltros({ ...SIN_FILTROS, categoria: 3 })).toBe(true)
    expect(cuantosFiltros({ ...SIN_FILTROS, categoria: 3, tramos: ['hasta5'], sinAgotados: true })).toBe(2)
    expect(hayFiltros(SIN_FILTROS)).toBe(false)
  })
})
