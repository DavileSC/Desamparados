import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import Cifras from '../Cifras'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL: PanelResponse = {
  generadoEn: '2026-09-14T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: {
    porEstado: [{ estado: 'DEVUELTO', total: 14, importe: 420 }],
    ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: '2026-06-01T00:00:00.000Z' },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
  },
}

describe('Cifras', () => {
  it('recoge las noticias y las publicaciones que enseñaba la actividad del equipo', () => {
    // Al sacar la auditoría del Inicio se llevaba por delante estos dos
    // números, que no son auditoría y el panel viejo ya enseñaba.
    renderWithProviders(<Cifras panel={PANEL} />)
    expect(screen.getByText(/4 noticias publicadas/)).toBeInTheDocument()
    expect(screen.getByText(/7 publicaciones/)).toBeInTheDocument()
  })
})
