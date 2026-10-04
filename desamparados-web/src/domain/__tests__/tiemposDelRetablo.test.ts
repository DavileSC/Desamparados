import { describe, it, expect } from 'vitest'
import { fotosDelAnio, tiempoDelDia, tramoDelTiempo, tramoEnPalabras } from '../tiemposDelRetablo'
import type { TiempoDelRetablo } from '../../lib/api/panel'

// Los mismos casos que backend-desamparados/test/retablo-dominio.test.ts: las dos gemelas tienen que decir lo mismo.
const foto = { foto: '/storage/public/a.webp', x: 50, y: 30 }
const CUARESMA: TiempoDelRetablo = { tiempo: 'cuaresma', ...foto }
const SEMANA_SANTA: TiempoDelRetablo = { tiempo: 'semana-santa', ...foto }
const NAVIDAD: TiempoDelRetablo = { tiempo: 'navidad', ...foto }
const MAYO: TiempoDelRetablo = { tiempo: 'a-mano', nombre: 'Mes de mayo', desde: '05-01', hasta: '05-31', ...foto }

describe('los tiempos del retablo (en la web)', () => {
  it('la Cuaresma y la Semana Santa de 2027', () => {
    expect(tramoDelTiempo(CUARESMA, 2027)).toEqual({ desde: '2027-02-10', hasta: '2027-03-28' })
    expect(tramoDelTiempo(SEMANA_SANTA, 2027)).toEqual({ desde: '2027-03-21', hasta: '2027-03-28' })
  })

  it('manda el más corto, y la Navidad cuenta en enero', () => {
    expect(tiempoDelDia([CUARESMA, SEMANA_SANTA], '2027-03-24')).toBe(1)
    expect(tiempoDelDia([CUARESMA, SEMANA_SANTA], '2027-03-01')).toBe(0)
    expect(tiempoDelDia([NAVIDAD], '2027-01-03')).toBe(0)
    expect(tiempoDelDia([CUARESMA, MAYO], '2026-10-05')).toBe(-1)
  })

  it('cada día del año tiene su foto: 31 de mayo en 2027', () => {
    const dias = fotosDelAnio([MAYO], 2027)
    expect(dias).toHaveLength(365)
    expect(dias.filter((i) => i === 0)).toHaveLength(31)
  })

  it('en palabras: las fechas a mano, cada año; las calculadas, la próxima vez', () => {
    expect(tramoEnPalabras(MAYO, new Date(2026, 9, 5))).toBe('Cada año, del 1 de mayo al 31 de mayo')
    expect(tramoEnPalabras(CUARESMA, new Date(2026, 9, 5))).toBe('En 2027, del 10 de febrero al 28 de marzo')
  })
})
