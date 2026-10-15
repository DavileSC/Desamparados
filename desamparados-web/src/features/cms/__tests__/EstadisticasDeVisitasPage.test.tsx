import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import EstadisticasDeVisitasPage from '../EstadisticasDeVisitasPage'

const responder = (cuerpo: unknown) => vi.fn().mockResolvedValue(
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }),
)

afterEach(() => { vi.unstubAllGlobals() })

describe('Estadísticas de visitas', () => {
  it('sin informe, explica qué falta', async () => {
    vi.stubGlobal('fetch', responder({ hay: false, actualizado: null }))
    renderWithProviders(<EstadisticasDeVisitasPage />, { modulos: ['estadisticas-de-visitas'] })
    expect(await screen.findByText('Todavía no hay informe.')).toBeInTheDocument()
    expect(screen.queryByTitle('Informe de visitas de la web')).not.toBeInTheDocument()
  })

  it('con informe, lo enseña en un marco aislado y dice cuándo se hizo', async () => {
    vi.stubGlobal('fetch', responder({ hay: true, actualizado: '2026-10-16T08:00:00.000Z' }))
    renderWithProviders(<EstadisticasDeVisitasPage />, { modulos: ['estadisticas-de-visitas'] })
    const marco = await screen.findByTitle('Informe de visitas de la web')
    expect(marco).toHaveAttribute('src', '/api/estadisticas-de-visitas/informe')
    // Sin allow-same-origin: el informe no puede tocar la sesión del CMS.
    expect(marco).toHaveAttribute('sandbox', 'allow-scripts')
    expect(screen.getByText(/Actualizado el 16 de octubre/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir en una pestaña' })).toHaveAttribute('target', '_blank')
  })
})
