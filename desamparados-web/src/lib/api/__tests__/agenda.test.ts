import { describe, it, expect, vi, afterEach } from 'vitest'
import { traerProximosEventos, type ApiEvent } from '../agenda'
import { isoEnMadrid } from '../../horaDeMadrid'
import { enZonaHoraria } from '../../../test/zonaHoraria'

// Desde Canarias, una hora menos que en Madrid: con la zona del equipo de
// pruebas (Madrid en local, UTC en el CI) no se distinguiría leer en Madrid de
// leer en local.
enZonaHoraria('Atlantic/Canary')
afterEach(() => { vi.unstubAllGlobals() })

const acto = (datos: Partial<ApiEvent>): ApiEvent => ({
  id: 1, title: 'Acto', description: null, location: null, startDate: isoEnMadrid('2026-10-03T19:00'), endDate: null, type: 'CULTO', ...datos,
})

function servir(data: ApiEvent[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 100, totalPages: 1 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
}

describe('los próximos actos del bloque de listado', () => {
  it('llevan el día y la hora de Madrid, no los de quien mira', async () => {
    servir([
      // A las 00:30 del 3 en Madrid; en Canarias, las 23:30 del 2.
      acto({ id: 1, startDate: isoEnMadrid('2026-10-03T00:30') }),
      // Del 2 a las 23:30 al 3 a las 00:30 en Madrid: dos días, aunque en Canarias sea uno.
      acto({ id: 2, startDate: isoEnMadrid('2026-10-02T23:30'), endDate: isoEnMadrid('2026-10-03T00:30') }),
    ])
    const [vigilia, velada] = await traerProximosEventos(2)
    expect(vigilia).toMatchObject({ fecha: '3 de octubre de 2026', hora: '00:30' })
    expect(velada.fecha).toBe('2 de octubre de 2026 - 3 de octubre de 2026')
  })
})
