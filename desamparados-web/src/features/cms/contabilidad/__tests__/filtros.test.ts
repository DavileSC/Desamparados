import { describe, it, expect } from 'vitest'
import { aFiltrosApi, fechasInvertidas, leerFiltrosUrl, rangoDePeriodo } from '../filtros'

// Un día fijo: los periodos se cuentan desde hoy.
const HOY = new Date(2026, 8, 11) // 11 de septiembre de 2026

describe('periodos', () => {
  it('el año en curso va del 1 de enero hasta hoy, no hasta diciembre', () => {
    // Si llegara a diciembre, se compararía lo que va de año con el año anterior entero.
    expect(rangoDePeriodo('anio', HOY)).toEqual({ desde: '2026-01-01', hasta: '2026-09-11' })
  })

  it('este mes y los últimos tres meses empiezan el día 1', () => {
    expect(rangoDePeriodo('mes', HOY)).toEqual({ desde: '2026-09-01', hasta: '2026-09-11' })
    expect(rangoDePeriodo('3meses', HOY)).toEqual({ desde: '2026-07-01', hasta: '2026-09-11' })
  })

  it('el año anterior va completo y el histórico no tiene fechas', () => {
    expect(rangoDePeriodo('anioAnterior', HOY)).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' })
    expect(rangoDePeriodo('todo', HOY)).toEqual({})
  })
})

describe('filtros en la URL', () => {
  it('sin nada en la URL: todo, año en curso', () => {
    expect(leerFiltrosUrl(new URLSearchParams())).toEqual({ tipo: 'TODO', periodo: 'anio', desde: '', hasta: '', categoria: '', metodo: '', q: '', recibo: '' })
  })

  it('lee cada filtro y descarta lo que no reconoce', () => {
    const filtros = leerFiltrosUrl(new URLSearchParams('tipo=GASTO&periodo=personalizado&desde=2026-01-01&hasta=2026-04-30&categoria=6&metodo=BIZUM&q=flores'))
    expect(filtros).toEqual({ tipo: 'GASTO', periodo: 'personalizado', desde: '2026-01-01', hasta: '2026-04-30', categoria: '6', metodo: 'BIZUM', q: 'flores', recibo: '' })
    expect(leerFiltrosUrl(new URLSearchParams('tipo=OTRO&periodo=siempre&categoria=x&metodo=CHEQUE')).tipo).toBe('TODO')
    expect(leerFiltrosUrl(new URLSearchParams('periodo=siempre')).periodo).toBe('anio')
  })

  it('traduce lo de la pantalla a lo que pide la API', () => {
    const ui = leerFiltrosUrl(new URLSearchParams('tipo=INGRESO&categoria=3&metodo=EFECTIVO&q=juan'))
    expect(aFiltrosApi(ui, HOY)).toEqual({ tipo: 'INGRESO', desde: '2026-01-01', hasta: '2026-09-11', categorias: [3], metodo: 'EFECTIVO', q: 'juan' })
    expect(aFiltrosApi(leerFiltrosUrl(new URLSearchParams('periodo=todo')), HOY)).toEqual({})
  })

  it('con un recibo solo pide sus apuntes, de cualquier fecha y sin los demás filtros', () => {
    const ui = leerFiltrosUrl(new URLSearchParams('recibo=42&tipo=GASTO&periodo=mes'))
    expect(aFiltrosApi(ui, HOY)).toEqual({ recibo: 42 })
    expect(leerFiltrosUrl(new URLSearchParams('recibo=abc')).recibo).toBe('')
  })

  it('un periodo personalizado a medias usa solo la fecha que tenga', () => {
    const ui = leerFiltrosUrl(new URLSearchParams('periodo=personalizado&desde=2026-03-01'))
    expect(aFiltrosApi(ui, HOY)).toEqual({ desde: '2026-03-01' })
  })
})

describe('fechas a elegir al revés (D12)', () => {
  it('se detectan solo con las dos fechas y el «hasta» antes del «desde»', () => {
    expect(fechasInvertidas({ periodo: 'personalizado', desde: '2026-05-01', hasta: '2026-01-31' })).toBe(true)
    expect(fechasInvertidas({ periodo: 'personalizado', desde: '2026-01-31', hasta: '2026-01-31' })).toBe(false)
    expect(fechasInvertidas({ periodo: 'personalizado', desde: '2026-05-01', hasta: '' })).toBe(false)
  })

  it('los periodos fijos nunca lo están, aunque la URL traiga fechas sueltas', () => {
    expect(fechasInvertidas({ periodo: 'anio', desde: '2026-05-01', hasta: '2026-01-31' })).toBe(false)
  })
})
