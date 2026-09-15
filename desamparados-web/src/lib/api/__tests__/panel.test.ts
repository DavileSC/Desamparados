import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPanel } from '../panel'

const respuesta = {
  generadoEn: '2026-08-28T10:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: {
    activos: 342,
    altas12m: 33,
    bajas12m: 9,
    sinNumeroHermano: 4,
    serieMensual: [],
    movimientosMensuales: [{ mes: '2026-01', altas: 3, bajas: 1 }],
    porEdad: [],
  },
  dinero: {
    porEstado: [],
    ejercicio: { anio: 2026, ingresos: 10, gastos: 4, saldo: 6 },
    serieMensual: [],
    porCategoria: [{ categoria: 'Limosna', tipo: 'INGRESO', total: 5, importe: 150 }],
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
  it('pide /api/panel y devuelve las cifras deserializadas, con credentials incluidas', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(respuesta), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchFalso)

    const panel = await getPanel()

    expect(fetchFalso).toHaveBeenCalledWith('/api/panel', expect.objectContaining({ credentials: 'include' }))
    expect(panel.censo.activos).toBe(342)
    expect(panel.actividad.noticias.borradores).toBe(2)
    expect(panel.ejercicio.anio).toBe(2026)
    expect(panel.dinero.porCategoria[0].importe).toBe(150)
  })

  it('sin año, pide el panel a secas', async () => {
    const espia = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(respuesta), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', espia)
    await getPanel()
    expect(espia.mock.calls[0][0]).toBe('/api/panel')
  })

  it('con año, lo manda en la query', async () => {
    const espia = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(respuesta), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', espia)
    await getPanel(2025)
    expect(espia.mock.calls[0][0]).toBe('/api/panel?anio=2025')
  })
})
