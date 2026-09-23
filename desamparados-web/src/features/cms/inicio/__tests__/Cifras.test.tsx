import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
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
  calendario: { mes: '2026-09', eventos: [], diasDeReparto: [] },
}

describe('Cifras', () => {
  it('enseña las cuatro cifras de hoy', () => {
    renderWithProviders(<TemaCmsProvider><Cifras panel={PANEL} /></TemaCmsProvider>)
    expect(screen.getByText('1.284')).toBeInTheDocument()
    expect(screen.getByText('612')).toBeInTheDocument()
    expect(screen.getByText('420 €')).toBeInTheDocument()
  })

  // El pie de noticias y publicaciones se mudó a «Próximos actos»: suelto bajo
  // las cifras, y sin título, parecía un resto. Sus tests se fueron con él.
  it('ya no lleva el pie de noticias y publicaciones', () => {
    renderWithProviders(<TemaCmsProvider><Cifras panel={PANEL} /></TemaCmsProvider>)
    expect(screen.queryByText(/noticias publicadas/)).not.toBeInTheDocument()
  })
})
