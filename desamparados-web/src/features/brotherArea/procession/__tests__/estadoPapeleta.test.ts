import { describe, it, expect } from 'vitest'
import { estadoPapeleta } from '../estadoPapeleta'

describe('estadoPapeleta', () => {
  it('pagada o exenta, la papeleta está asignada', () => {
    expect(estadoPapeleta('PAGADO')).toEqual({ texto: 'Asignada', color: 'success.main' })
    expect(estadoPapeleta('EXENTO')).toEqual({ texto: 'Asignada', color: 'success.main' })
  })

  it('pendiente o remesada, aún está por cobrar', () => {
    expect(estadoPapeleta('PENDIENTE').texto).toBe('Pendiente')
    expect(estadoPapeleta('REMESADO').texto).toBe('Pendiente')
  })

  it('devuelta o anulada, no da sitio', () => {
    expect(estadoPapeleta('DEVUELTO').texto).toBe('No disponible')
    expect(estadoPapeleta('ANULADO').texto).toBe('No disponible')
  })
})
