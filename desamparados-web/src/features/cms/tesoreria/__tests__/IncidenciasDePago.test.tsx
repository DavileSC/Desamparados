import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { QueryClient } from '@tanstack/react-query'
import IncidenciasDePago from '../IncidenciasDePago'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
const INCIDENCIA = { id: 7, pedido: '00000042AB7Z', fecha: '2026-10-02T10:00:00.000Z', importe: 30, metodo: 'TARJETA', autorizacion: '654321', motivo: 'No se pudo aplicar el pago: «Cuota 2026» no está pendiente de pago.', correo: 'hermano@example.com', origen: 'AREA_HERMANOS', anulable: false }

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('IncidenciasDePago', () => {
  it('sin incidencias no enseña nada', async () => {
    const fetch = vi.fn().mockResolvedValue(json([]))
    vi.stubGlobal('fetch', fetch)
    const { container } = renderWithProviders(<IncidenciasDePago />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('enseña lo que hay que devolver y lo marca como devuelto', async () => {
    const user = userEvent.setup()
    let pendientes = [INCIDENCIA]
    const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
      if (init.method === 'POST') { pendientes = []; return Promise.resolve(json({ message: 'ok' })) }
      return Promise.resolve(json(pendientes))
    })
    vi.stubGlobal('fetch', fetch)
    renderWithProviders(<IncidenciasDePago />)

    expect(await screen.findByText('Un pago en línea por devolver')).toBeInTheDocument()
    expect(screen.getByText(/pedido 00000042AB7Z · autorización 654321/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Devuelto' }))
    await waitFor(() => expect(screen.queryByText('Un pago en línea por devolver')).not.toBeInTheDocument())
    expect(fetch.mock.calls.some(([url, init]) => String(url).includes('/incidencias/7/resolver') && (init as RequestInit).method === 'POST')).toBe(true)
    // «Devuelto» a secas no anula nada: va sin cuerpo, como siempre.
    expect(fetch.mock.calls.find(([, init]) => (init as RequestInit).method === 'POST')?.[1]?.body).toBeUndefined()
  })

  it('«Devuelto» a secas en un pago de la tienda refresca la Tienda; en una cuota, no', async () => {
    const user = userEvent.setup()
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    let pendientes = [{ ...INCIDENCIA, origen: 'TIENDA', anulable: true }, { ...INCIDENCIA, id: 8, pedido: '00000043AB7Z' }]
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
      if (init.method === 'POST') {
        const id = Number(/incidencias\/(\d+)\//.exec(String(url))?.[1])
        pendientes = pendientes.filter((i) => i.id !== id)
        return Promise.resolve(json({ message: 'ok' }))
      }
      return Promise.resolve(json(pendientes))
    })
    vi.stubGlobal('fetch', fetch)
    renderWithProviders(<IncidenciasDePago />)

    expect(await screen.findByText('2 pagos en línea por devolver')).toBeInTheDocument()
    // La cuota del área de hermanos no toca la Tienda.
    await user.click(screen.getAllByRole('button', { name: 'Devuelto' })[1])
    expect(await screen.findByText('Un pago en línea por devolver')).toBeInTheDocument()
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['tienda'] })
    // El pedido de la tienda deja de ser «Cobrado sin completar».
    await user.click(screen.getByRole('button', { name: 'Devuelto' }))
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tienda'] }))
  })

  it('se puede resolver anulando el pedido, tras confirmarlo', async () => {
    const user = userEvent.setup()
    let pendientes = [{ ...INCIDENCIA, origen: 'TIENDA', anulable: true }]
    const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
      if (init.method === 'POST') { pendientes = []; return Promise.resolve(json({ message: 'Incidencia resuelta y pedido anulado' })) }
      return Promise.resolve(json(pendientes))
    })
    vi.stubGlobal('fetch', fetch)
    renderWithProviders(<IncidenciasDePago />)

    await user.click(await screen.findByRole('button', { name: 'Devuelto y anular el pedido' }))
    expect(fetch.mock.calls.some(([, init]) => (init as RequestInit).method === 'POST')).toBe(false)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Devuelto y anular' }))

    expect(await screen.findByText('Incidencia resuelta y pedido anulado')).toBeInTheDocument()
    const [url, init] = fetch.mock.calls.find(([, i]) => (i as RequestInit).method === 'POST')!
    expect(String(url)).toContain('/incidencias/7/resolver')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ anular: true })
  })

  it('si lo que se pagaba no se anula desde aquí, dice por qué y la incidencia sigue', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => init.method === 'POST'
      ? Promise.resolve(new Response(JSON.stringify({ message: 'Lo que se pagaba con esta incidencia no se puede anular desde aquí.' }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
      : Promise.resolve(json([{ ...INCIDENCIA, origen: 'TIENDA', anulable: true }]))))
    renderWithProviders(<IncidenciasDePago />)

    await user.click(await screen.findByRole('button', { name: 'Devuelto y anular el pedido' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Devuelto y anular' }))
    expect(await screen.findByText(/no se puede anular desde aquí/)).toBeInTheDocument()
    expect(screen.getByText('Un pago en línea por devolver')).toBeInTheDocument()
  })

  it('una cuota del área no ofrece anular, y dice de dónde viene', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json([INCIDENCIA]))))
    renderWithProviders(<IncidenciasDePago />)
    expect(await screen.findByRole('button', { name: 'Devuelto' })).toBeInTheDocument()
    expect(screen.getByText(/· Área de hermanos ·/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Devuelto y anular el pedido' })).not.toBeInTheDocument()
  })

  it('un pedido de la tienda que el servidor no deja anular tampoco lo ofrece', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json([{ ...INCIDENCIA, origen: 'TIENDA', anulable: false }]))))
    renderWithProviders(<IncidenciasDePago />)
    expect(await screen.findByRole('button', { name: 'Devuelto' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Devuelto y anular el pedido' })).not.toBeInTheDocument()
  })
})
