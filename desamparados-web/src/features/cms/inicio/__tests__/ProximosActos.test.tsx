import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import ProximosActos from '../ProximosActos'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL: PanelResponse = {
  generadoEn: '2026-09-14T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: { porEstado: [], ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 }, serieMensual: [], porCategoria: [] },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: '2026-06-01T00:00:00.000Z' },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
  },
}

/**
 * El pie de noticias y publicaciones vive aquí desde que se sacó de debajo de
 * las cifras, donde quedaba suelto y sin título que lo explicara.
 */
describe('ProximosActos', () => {
  it('recoge las noticias y las publicaciones que enseñaba la actividad del equipo', () => {
    // Al sacar la auditoría del Inicio se llevaba por delante estos dos
    // números, que no son auditoría y el panel viejo ya enseñaba.
    renderWithProviders(<ProximosActos eventos={[]} actividad={PANEL.actividad} />)
    expect(screen.getByText(/4 noticias publicadas/)).toBeInTheDocument()
    expect(screen.getByText(/7 publicaciones/)).toBeInTheDocument()
  })

  // Los dos casos de abajo los cubría `PanelPage.test.tsx` hasta que la
  // auditoría salió del Inicio. La lógica se mudó aquí (la rama
  // `publicaciones.ultima && ...`) y se quedó sin nadie que la mirase.

  it('el pie fecha la última publicación', () => {
    renderWithProviders(<ProximosActos eventos={[]} actividad={PANEL.actividad} />)
    expect(screen.getByText(/última el 1 jun 2026/)).toBeInTheDocument()
  })

  it('sin ninguna publicación registrada, el pie no menciona una fecha', () => {
    // No hay fecha que dar: «última el 1 ene 1970» sería peor que callarse.
    const sinPublicaciones: PanelResponse = {
      ...PANEL,
      actividad: { ...PANEL.actividad, publicaciones: { total: 0, ultima: null } },
    }
    renderWithProviders(<ProximosActos eventos={[]} actividad={sinPublicaciones.actividad} />)
    expect(screen.getByText(/0 publicaciones/)).toBeInTheDocument()
    expect(screen.queryByText(/última el/)).not.toBeInTheDocument()
  })
})
