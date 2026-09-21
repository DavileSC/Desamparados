import { describe, it, expect } from 'vitest'
import { aApunteManual, apunteCompleto, apunteDesde, apunteNuevo, categoriasParaApunte, errorFecha, errorImporte, errorNombreCategoria, type FormApunte } from '../apunte'
import type { Category, Transaction } from '../../../../lib/api/contabilidad'

// Un día fijo: «hoy» manda sobre la fecha por defecto y sobre las fechas futuras.
const HOY = new Date(2026, 8, 11, 10, 0) // 11 de septiembre de 2026, hora local

const LLENO: FormApunte = { tipo: 'GASTO', categoriaId: '6', concepto: 'Exorno floral', importe: '342,50', fecha: '2026-08-09', metodoPago: 'TRANSFERENCIA' }

describe('importe de un apunte', () => {
  it('vale con coma o punto y hasta dos decimales', () => {
    for (const importe of ['18', '12,5', '12.50', '0.01', '99999999.99']) expect(errorImporte(importe)).toBeNull()
  })

  it('con tres decimales avisa: la base de datos lo redondeaba sin decir nada', () => {
    expect(errorImporte('12.345')).toBe('Como mucho dos decimales.')
    expect(errorImporte('12,345')).toBe('Como mucho dos decimales.')
  })

  it('cero, negativos, más del tope o texto no valen', () => {
    expect(errorImporte('0')).toBe('Tiene que ser mayor que cero.')
    expect(errorImporte('-5')).toBe('Tiene que ser mayor que cero.')
    expect(errorImporte('100000000')).toBe('No puede pasar de 99.999.999,99 €.')
    expect(errorImporte('1e3')).toBe('Escribe un importe como 12,50.')
  })

  it('vacío no enseña error (el botón ya queda deshabilitado)', () => {
    expect(errorImporte('')).toBeNull()
  })
})

describe('fecha de un apunte', () => {
  it('hoy y antes valen; mañana, no', () => {
    expect(errorFecha('2026-09-11', HOY)).toBeNull()
    expect(errorFecha('2025-01-31', HOY)).toBeNull()
    expect(errorFecha('2026-09-12', HOY)).toBe('No puede ser posterior a hoy.')
  })

  it('días que no existen o vacíos no valen', () => {
    expect(errorFecha('2026-02-30', HOY)).toBe('Fecha no válida.')
    expect(errorFecha('', HOY)).toBe('Elige la fecha.')
  })
})

describe('formulario de apunte', () => {
  it('uno nuevo va fechado hoy y sin método elegido', () => {
    expect(apunteNuevo(HOY)).toEqual({ tipo: 'INGRESO', categoriaId: '', concepto: '', importe: '', fecha: '2026-09-11', metodoPago: '' })
  })

  it('solo se manda completo: con categoría, método, concepto e importe válidos', () => {
    expect(apunteCompleto(LLENO, HOY)).toBe(true)
    expect(apunteCompleto({ ...LLENO, metodoPago: '' }, HOY)).toBe(false)
    expect(apunteCompleto({ ...LLENO, concepto: '  ab ' }, HOY)).toBe(false)
    expect(apunteCompleto({ ...LLENO, importe: '1.005' }, HOY)).toBe(false)
    expect(apunteCompleto({ ...LLENO, fecha: '2026-09-12' }, HOY)).toBe(false)
  })

  it('se traduce a lo que pide la API, con el importe como número', () => {
    expect(aApunteManual({ ...LLENO, concepto: '  Exorno floral  ' })).toEqual({
      tipo: 'GASTO', categoriaId: 6, concepto: 'Exorno floral', importe: 342.5, fecha: '2026-08-09', metodoPago: 'TRANSFERENCIA',
    })
  })

  it('corregir parte del apunte tal como está', () => {
    const apunte: Transaction = { id: 2, tipo: 'GASTO', concepto: 'Exorno floral', importe: '342.50', fecha: new Date(2026, 7, 9, 12).toISOString(), metodoPago: null, categoriaId: 6, reciboId: null, categoria: { nombre: 'Flores' }, hermano: null }
    // Uno antiguo sin método obliga a elegirlo al corregir.
    expect(apunteDesde(apunte)).toEqual({ tipo: 'GASTO', categoriaId: '6', concepto: 'Exorno floral', importe: '342.5', fecha: '2026-08-09', metodoPago: '' })
  })
})

describe('categorías que se ofrecen', () => {
  const CATEGORIAS: Category[] = [
    { id: 3, nombre: 'Donativos', tipo: 'INGRESO', activa: true },
    { id: 4, nombre: 'Rifas antiguas', tipo: 'INGRESO', activa: false },
    { id: 6, nombre: 'Flores', tipo: 'GASTO', activa: true },
  ]

  it('al apuntar, solo las activas del tipo', () => {
    expect(categoriasParaApunte(CATEGORIAS, 'INGRESO').map((c) => c.id)).toEqual([3])
  })

  it('al corregir, también la desactivada que ya tenía el apunte', () => {
    expect(categoriasParaApunte(CATEGORIAS, 'INGRESO', '4').map((c) => c.id)).toEqual([3, 4])
  })

  it('el nombre de una categoría: de 3 a 60 caracteres útiles, sin < ni >', () => {
    expect(errorNombreCategoria('  ab  ')).toBe('Al menos 3 caracteres.')
    expect(errorNombreCategoria('x'.repeat(61))).toBe('Como mucho 60 caracteres.')
    expect(errorNombreCategoria('<b>Flores</b>')).toBe('Sin los signos < ni >.')
    expect(errorNombreCategoria('Flores')).toBeNull()
  })
})
