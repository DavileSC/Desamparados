import { describe, it, expect } from 'vitest'
import { anioDe, fechaDelActo, proximaFila } from '../programa'
import type { EventoCalendario } from '../../../lib/api/agenda'
import type { FilaDePrograma } from '../../../lib/api/contenido'

const fila = (cuando: string, mes: number): FilaDePrograma => ({ cuando, mes, titulo: cuando, texto: '', boton: '', enlace: '' })
const FILAS = [fila('Octubre', 10), fila('Noviembre', 11), fila('Cuaresma', 3), fila('Cada mes', 0)]
const acto = (fecha: string, type: EventoCalendario['type'] = 'CULTO'): EventoCalendario =>
  ({ id: fecha, title: 'Acto', description: '', type, start: new Date(fecha), end: null })

describe('proximaFila', () => {
  it('en septiembre toca octubre, con su fecha si la Agenda ya la tiene', () => {
    const ahora = new Date('2026-09-26T10:00:00+02:00')
    expect(proximaFila(FILAS, [], ahora)).toEqual({ indice: 0, acto: null })
    const rosario = acto('2026-10-17T20:00:00+02:00', 'PROCESION')
    expect(proximaFila(FILAS, [rosario, acto('2026-11-20T20:00:00+01:00')], ahora)).toEqual({ indice: 0, acto: rosario })
  })

  it('del mes en curso solo vale si queda un culto por delante', () => {
    const ahora = new Date('2026-10-25T10:00:00+02:00')
    expect(proximaFila(FILAS, [], ahora)?.indice).toBe(1)
    expect(proximaFila(FILAS, [acto('2026-10-30T20:00:00+01:00')], ahora)?.indice).toBe(0)
  })

  it('solo cuentan cultos y salidas, no la formación ni un ensayo', () => {
    const ahora = new Date('2026-10-25T10:00:00+02:00')
    expect(proximaFila(FILAS, [acto('2026-10-30T20:00:00+01:00', 'FORMACION')], ahora)?.indice).toBe(1)
  })

  it('pasa de año y nunca marca las filas sin mes fijo', () => {
    const ahora = new Date('2026-12-10T10:00:00+01:00')
    expect(proximaFila(FILAS, [], ahora)?.indice).toBe(2)
    expect(proximaFila([fila('Cada mes', 0)], [], ahora)).toBeNull()
  })
})

describe('fechas', () => {
  it('escribe la fecha del acto en hora de Madrid', () => {
    expect(fechaDelActo(acto('2026-10-17T18:00:00Z'))).toBe('Sábado, 17 de octubre · 20:00')
  })

  it('el año es el natural, en hora de Madrid', () => {
    expect(anioDe(new Date('2026-09-26T10:00:00+02:00'))).toBe('2026')
    // A las 23:30 de Nochevieja en Madrid aún es 2026; a las 00:30, ya 2027.
    expect(anioDe(new Date('2026-12-31T22:30:00Z'))).toBe('2026')
    expect(anioDe(new Date('2026-12-31T23:30:00Z'))).toBe('2027')
  })
})
