import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import tema from '../../../../theme'
import AvisoPersonalPage from '../AvisoPersonalPage'

const carta = '<!doctype html><html><head><title>Carta</title></head><body><p>Le recordamos que mañana tiene cita.</p><a href="https://ejemplo.test/area-hermano/procesion">Ir al área de hermanos</a></body></html>'

afterEach(() => { vi.unstubAllGlobals() })

function montar(estado = 200) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(
    estado === 200
      ? new Response(JSON.stringify({ id: 7, asunto: 'Mañana, recogida de la papeleta', enviadoEl: '2026-10-15T08:00:00.000Z', html: carta }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ error: 'Ese aviso no está entre los tuyos.' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
  ))
  vi.stubGlobal('fetch', fetch)
  const router = createMemoryRouter(
    [
      { path: '/area-hermano/avisos', element: <h1>Avisos</h1> },
      { path: '/area-hermano/avisos/personal/:id', element: <AvisoPersonalPage /> },
    ],
    { initialEntries: ['/area-hermano/avisos/personal/7'] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={tema}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  return fetch
}

describe('AvisoPersonalPage', () => {
  it('enseña la carta del aviso, la misma del correo, en un marco sin scripts', async () => {
    const fetch = montar()

    expect(await screen.findByRole('heading', { name: 'Mañana, recogida de la papeleta' })).toBeInTheDocument()
    expect(screen.getByText('15 de octubre de 2026')).toBeInTheDocument()
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/hermanos\/mis-avisos\/personales\/7$/)

    const marco = screen.getByTitle('Mañana, recogida de la papeleta')
    expect(marco.getAttribute('sandbox')).not.toMatch(/allow-scripts/)
    // Los enlaces de la carta abren en la página, no dentro del marco.
    expect(marco.getAttribute('srcdoc')).toMatch(/<head><base target="_top"><title>Carta<\/title>/)
    expect(screen.getByRole('link', { name: /Avisos/ })).toHaveAttribute('href', '/area-hermano/avisos')
  })

  it('si no es suyo o no existe, lo dice', async () => {
    montar(404)
    expect(await screen.findByText('No se ha podido cargar el aviso.')).toBeInTheDocument()
  })
})
