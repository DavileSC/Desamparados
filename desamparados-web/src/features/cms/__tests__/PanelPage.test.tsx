import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import PanelPage from '../PanelPage'
import type { PanelResponse } from '../../../lib/api/panel'

const panel: PanelResponse = {
  generadoEn: '2026-08-28T10:00:00.000Z',
  censo: {
    activos: 342,
    altas12m: 33,
    bajas12m: 9,
    sinNumeroHermano: 4,
    serieMensual: [
      { mes: '2026-07', activos: 341 },
      { mes: '2026-08', activos: 342 },
    ],
    porEdad: [{ tramo: '18-30', total: 60 }],
  },
  dinero: {
    porEstado: [
      { estado: 'PAGADO', total: 289, importe: 13005 },
      { estado: 'PENDIENTE', total: 41, importe: 1855 },
    ],
    ejercicio: { anio: 2026, ingresos: 18400, gastos: 11990, saldo: 6410 },
    serieMensual: [
      { mes: '2026-07', ingresos: 1200, gastos: 800 },
      { mes: '2026-08', ingresos: 1500, gastos: 950 },
    ],
    porCategoria: [{ categoria: 'Flores Cuaresma', tipo: 'GASTO', total: 12 }],
  },
  procesion: {
    anio: 2026,
    papeletas: 302,
    porAnio: [{ anio: 2026, total: 302 }],
    porPuesto: [{ etiqueta: 'Nazarenos', total: 168 }],
    porTalla: [{ etiqueta: 'L', total: 90 }],
    porAlturaHombro: [{ tramo: '170-179', total: 41 }],
  },
  actividad: {
    proximosEventos: [
      { id: 1, title: 'Cabildo de oficiales', startDate: '2026-09-06T18:00:00.000Z', type: 'REUNION' },
    ],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: '2026-06-01T00:00:00.000Z' },
    reparto: { turnosProximos: 3, citasReservadas: 118, capacidadEstimada: 300 },
  },
}

function responder(cuerpo: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('PanelPage', () => {
  it('enseña las cifras principales', async () => {
    responder(panel)
    renderWithProviders(<PanelPage />)
    // findAllByText, no findByText: 342 es a la vez "hermanos activos" (la
    // cifra grande) y el último punto de "activos mes a mes" (la etiqueta del
    // gráfico), así que aparece dos veces de forma legítima.
    expect((await screen.findAllByText('342')).length).toBeGreaterThan(0)
    expect(screen.getByText('302')).toBeInTheDocument()
  })

  it('pinta los cuatro bloques', async () => {
    responder(panel)
    renderWithProviders(<PanelPage />)
    expect(await screen.findByRole('heading', { name: /censo/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tesorería/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /procesión/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /actividad/i })).toBeInTheDocument()
  })

  it('avisa mientras carga', () => {
    responder(panel)
    renderWithProviders(<PanelPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('explica el fallo si el servidor no responde', async () => {
    responder({}, 500)
    renderWithProviders(<PanelPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })

  it('aguanta un Grupo Parroquial recién instalado, con todo a cero', async () => {
    responder({
      ...panel,
      censo: { activos: 0, altas12m: 0, bajas12m: 0, sinNumeroHermano: 0, serieMensual: [], porEdad: [] },
      dinero: {
        porEstado: [],
        ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 },
        serieMensual: [],
        porCategoria: [],
      },
      procesion: { anio: 2026, papeletas: 0, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
    })
    renderWithProviders(<PanelPage />)
    expect(await screen.findAllByText(/todavía no hay datos/i)).not.toHaveLength(0)
  })
})
