import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import EventsAndLive from '../EventsAndLive'

afterEach(() => { vi.unstubAllGlobals() })

describe('EventsAndLive', () => {
  it('sigue pintando los próximos eventos con la respuesta paginada', async () => {
    // Regresión: al pasar /api/events a {data, meta}, esta sección de la
    // portada se queda en blanco si sigue leyendo la respuesta como un array.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        data: [{ id: 1, title: 'Besapiés', description: null, location: 'Parroquia', startDate: '2026-09-12T18:00:00.000Z', endDate: null, visibility: 'public', type: 'CULTO' }],
        meta: { total: 1, page: 1, limit: 3, totalPages: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    renderWithProviders(<EventsAndLive />)
    expect(await screen.findByText(/besapiés/i)).toBeInTheDocument()
  })
})
