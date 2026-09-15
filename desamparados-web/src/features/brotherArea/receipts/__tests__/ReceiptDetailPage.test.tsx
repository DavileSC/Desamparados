import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import tema from '../../../../theme'
import ReceiptDetailPage from '../ReceiptDetailPage'

const detalle = {
  id: 10,
  year: 2026,
  concepto: 'Cuota anual',
  importe: 30,
  tipo: 'CUOTA_HERMANO',
  estado: 'PAGADO',
  fechaEmision: '2026-01-15T00:00:00.000Z',
  fechaPago: '2026-02-03T00:00:00.000Z',
  metodoPago: 'TRANSFERENCIA',
  hermano: { nombre: 'Ana', apellidos: 'Pérez Ruiz', esTitular: true },
}

afterEach(() => { vi.unstubAllGlobals() })

function montar(id = 10) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
    id === 10
      ? new Response(JSON.stringify(detalle), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ error: 'Recibo no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
  )))

  const router = createMemoryRouter(
    [
      { path: '/area-hermano/recibos', element: <h1>Recibos</h1> },
      { path: '/area-hermano/recibos/:id', element: <ReceiptDetailPage /> },
    ],
    { initialEntries: [`/area-hermano/recibos/${id}`] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={tema}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('ReceiptDetailPage', () => {
  it('enseña el desglose que no cabe en la fila del listado', async () => {
    montar()

    expect(await screen.findByRole('heading', { name: /cuota anual/i })).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByText('30,00 €')).toBeInTheDocument()
    expect(screen.getByText(/pagado/i)).toBeInTheDocument()
    // Lo propio del detalle: tipo y método de pago traducidos, no el nombre del enum.
    expect(screen.getByText('Cuota de hermano')).toBeInTheDocument()
    expect(screen.getByText('Transferencia')).toBeInTheDocument()
    // «Concepto» es el titular de la pantalla («Cuota anual»); la fila de
    // debajo es el TIPO y tiene que llamarse así, o son dos conceptos distintos
    // con el mismo nombre.
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.queryByText('Concepto')).not.toBeInTheDocument()
  })

  it('pide el recibo que dice la URL', async () => {
    montar()

    await screen.findByRole('heading', { name: /cuota anual/i })
    const simulado = vi.mocked(fetch)
    expect(String(simulado.mock.calls[0]?.[0])).toContain('/recibos/mis-recibos/10')
  })

  it('vuelve al listado', async () => {
    montar()

    const volver = await screen.findByRole('link', { name: /recibos/i })
    expect(volver).toHaveAttribute('href', '/area-hermano/recibos')
  })

  it('explica el fallo si el recibo no es suyo', async () => {
    montar(999)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })
})
