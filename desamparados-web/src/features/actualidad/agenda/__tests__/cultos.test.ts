import { describe, it, expect } from 'vitest'
import type { ApiEvent } from '../../../../lib/api/agenda'
import { caeEnElDia, claseDelActo, cuandoEnCartel, fotoDelCartel, notaDelActo, primerDiaEnElMes, ultimoMes, urlDelMapa } from '../cultos'

const en = (dia: string, hora = '19:00') => new Date(`${dia}T${hora}`).toISOString()
const acto = (datos: Partial<ApiEvent>): ApiEvent => ({
  id: 1, title: 'Acto', description: null, location: null, startDate: en('2026-10-03'), endDate: null, type: 'CULTO', ...datos,
})

describe('la agenda de cultos', () => {
  it('sabe qué días del calendario ocupa cada acto', () => {
    const triduo = acto({ startDate: en('2026-11-03'), endDate: en('2026-11-05', '20:00') })
    expect(caeEnElDia(triduo, new Date(2026, 10, 4))).toBe(true)
    expect(caeEnElDia(triduo, new Date(2026, 10, 6))).toBe(false)
    // Uno que viene del mes anterior se ancla en el día 1.
    const cruzaMes = acto({ startDate: en('2026-10-30'), endDate: en('2026-11-02') })
    expect(primerDiaEnElMes(cruzaMes, new Date(2026, 10, 1))).toEqual(new Date(2026, 10, 1))
    expect(primerDiaEnElMes(cruzaMes, new Date(2026, 9, 1))).toEqual(new Date(2026, 9, 30))
    expect(primerDiaEnElMes(cruzaMes, new Date(2026, 11, 1))).toBeNull()
  })

  it('se puede llegar hasta el mes del último acto, y nunca a antes de hoy', () => {
    const hoy = new Date(2026, 8, 26)
    expect(ultimoMes([], hoy)).toEqual(new Date(2026, 8, 1))
    expect(ultimoMes([acto({}), acto({ startDate: en('2026-12-30'), endDate: en('2027-01-02') })], hoy)).toEqual(new Date(2027, 0, 1))
  })

  it('en la ventana dice qué es y dónde, con su punto', () => {
    expect(claseDelActo(acto({ cartel: true }))).toBe('Culto solemne')
    expect(claseDelActo(acto({}))).toBe('Culto')
    expect(claseDelActo(acto({ type: 'FORMACION' }))).toBe('Formación')
    expect(notaDelActo(acto({ location: 'Salón parroquial', description: 'Con merienda.' }))).toBe('Salón parroquial. Con merienda.')
    expect(notaDelActo(acto({}))).toBe('')
  })

  it('dice las fechas como se dicen', () => {
    expect(cuandoEnCartel(acto({}))).toBe('Sábado 3 de octubre')
    const triduo = acto({ startDate: en('2026-11-03'), endDate: en('2026-11-05', '20:00') })
    expect(cuandoEnCartel(triduo)).toBe('Días 3, 4 y 5 de noviembre')
    const cruzaMes = acto({ startDate: en('2026-10-30'), endDate: en('2026-11-02') })
    expect(cuandoEnCartel(cruzaMes)).toBe('Del 30 de octubre al 2 de noviembre')
    expect(cuandoEnCartel(acto({ startDate: en('2026-10-13', '18:00'), endDate: en('2026-10-13', '21:00') }))).toBe('Martes 13 de octubre')
  })

  it('sin foto propia, la de la Titular o la de la procesión', () => {
    expect(fotoDelCartel(acto({})).src).toBe('/images/triduo.jpg')
    expect(fotoDelCartel(acto({ type: 'PROCESION' })).src).toBe('/images/procesion.jpg')
    expect(fotoDelCartel(acto({ fotoCartel: '/storage/public/x.jpg' })).src).toBe('/storage/public/x.jpg')
  })

  it('el mapa busca en Málaga, y sin lugar no hay mapa', () => {
    expect(urlDelMapa('Salón parroquial')).toContain(encodeURIComponent('Salón parroquial, Málaga'))
    expect(urlDelMapa('Catedral de Málaga')).not.toContain(encodeURIComponent(', Málaga'))
    expect(urlDelMapa('  ')).toBeNull()
  })
})
