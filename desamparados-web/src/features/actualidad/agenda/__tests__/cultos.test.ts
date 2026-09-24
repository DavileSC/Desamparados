import { describe, it, expect } from 'vitest'
import type { ApiEvent } from '../../../../lib/api/agenda'
import { cuandoEnCartel, cuandoEnLista, enTramos, fotoDelCartel, pasaElFiltro, urlDelMapa } from '../cultos'

const en = (dia: string, hora = '19:00') => new Date(`${dia}T${hora}`).toISOString()
const acto = (datos: Partial<ApiEvent>): ApiEvent => ({
  id: 1, title: 'Acto', description: null, location: null, startDate: en('2026-10-03'), endDate: null, type: 'CULTO', ...datos,
})

describe('la agenda de cultos', () => {
  it('parte la lista por los carteles', () => {
    const [a, b, c, d] = [acto({ id: 1 }), acto({ id: 2, cartel: true }), acto({ id: 3 }), acto({ id: 4 })]
    expect(enTramos([a, b, c, d])).toEqual([{ actos: [a] }, { cartel: b }, { actos: [c, d] }])
    expect(enTramos([b])).toEqual([{ cartel: b }])
  })

  it('dice las fechas como se dicen', () => {
    expect(cuandoEnLista(acto({}))).toBe('3 de octubre, sábado')
    expect(cuandoEnCartel(acto({}))).toBe('Sábado 3 de octubre')
    const triduo = acto({ startDate: en('2026-11-03'), endDate: en('2026-11-05', '20:00') })
    expect(cuandoEnLista(triduo)).toBe('3, 4 y 5 de noviembre')
    expect(cuandoEnCartel(triduo)).toBe('Días 3, 4 y 5 de noviembre')
    const cruzaMes = acto({ startDate: en('2026-10-30'), endDate: en('2026-11-02') })
    expect(cuandoEnCartel(cruzaMes)).toBe('Del 30 de octubre al 2 de noviembre')
    expect(cuandoEnLista(acto({ startDate: en('2026-10-13', '18:00'), endDate: en('2026-10-13', '21:00') }))).toBe('13 de octubre, martes')
  })

  it('filtra por lo que busca quien entra', () => {
    expect(pasaElFiltro(acto({ type: 'PROCESION' }), 'cultos')).toBe(true)
    expect(pasaElFiltro(acto({ type: 'ENSAYO' }), 'vida')).toBe(true)
    expect(pasaElFiltro(acto({ type: 'FORMACION' }), 'cultos')).toBe(false)
    expect(pasaElFiltro(acto({ type: 'OTRO' }), 'todo')).toBe(true)
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
