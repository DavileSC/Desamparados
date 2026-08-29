import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPanel } from '../panel'

const respuesta = {
  generadoEn: '2026-08-28T10:00:00.000Z',
  censo: { activos: 342, altas12m: 33, bajas12m: 9, sinNumeroHermano: 4, serieMensual: [], porEdad: [] },
  dinero: {
    porEstado: [],
    ejercicio: { anio: 2026, ingresos: 10, gastos: 4, saldo: 6 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 302, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: null },
    reparto: { turnosProximos: 3, citasReservadas: 118, capacidadEstimada: 300 },
  },
}

afterEach(() => { vi.unstubAllGlobals() })

describe('getPanel', () => {
  it('pide /api/panel y devuelve las cifras', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(respuesta), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchFalso)

    const panel = await getPanel()

    expect(fetchFalso).toHaveBeenCalledWith('/api/panel', expect.objectContaining({ credentials: 'include' }))
    expect(panel.censo.activos).toBe(342)
    expect(panel.actividad.noticias.borradores).toBe(2)
  })

  it('propaga el error cuando el servidor responde mal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    await expect(getPanel()).rejects.toThrow()
  })
})
