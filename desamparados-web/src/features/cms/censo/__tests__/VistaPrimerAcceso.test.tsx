import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import VistaPrimerAcceso from '../VistaPrimerAcceso'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const cuenta = (id: number, nombre: string, extra: Record<string, unknown> = {}) => ({
  id, nombre, apellidos: 'Ruiz Montes', email: `${nombre.toLowerCase()}@ejemplo.test`, numeroHermano: 200 + id, aCargo: 0,
  invitadoEn: null, fichaConfirmadaEn: null, enCola: false, ...extra,
})

function api() {
  const filas = [
    cuenta(1, 'Antonio', { aCargo: 2 }),
    cuenta(2, 'Carmen', { invitadoEn: '2026-10-05T10:00:00.000Z' }),
    cuenta(3, 'Pedro', { invitadoEn: '2026-10-05T10:00:00.000Z', fichaConfirmadaEn: '2026-10-06T10:00:00.000Z' }),
  ]
  const simulado = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => Promise.resolve(init.method === 'POST'
    ? json({ encoladas: 1 }, 202)
    : json({ data: filas, meta: { total: 3, page: 1, limit: 20, totalPages: 1 }, cifras: { sinInvitar: 1, invitados: 1, confirmados: 1, enCola: 0 } })))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const posts = (simulado: ReturnType<typeof api>) => simulado.mock.calls
  .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
  .map(([url, init]) => [String(url), JSON.parse(String((init as RequestInit).body))])

afterEach(() => { vi.unstubAllGlobals() })

describe('VistaPrimerAcceso', () => {
  it('dice en qué está cada cuenta y deja reenviar a quien no ha confirmado', async () => {
    const usuario = userEvent.setup()
    const simulado = api()
    renderWithProviders(<VistaPrimerAcceso />)

    const lista = await screen.findByRole('list', { name: 'Cuentas del censo importado' })
    expect(within(lista).getByText(/2 fichas a su cargo/)).toBeInTheDocument()
    expect(within(lista).getByText('Sin invitar')).toBeInTheDocument()
    expect(within(lista).getByText(/Confirmó el/)).toBeInTheDocument()
    // A quien ya confirmó no se le vuelve a invitar.
    expect(within(lista).queryByRole('button', { name: /Pedro/ })).not.toBeInTheDocument()

    await usuario.click(within(lista).getByRole('button', { name: 'Reenviar la invitación a Carmen Ruiz Montes' }))
    await waitFor(() => expect(posts(simulado)).toEqual([[expect.stringContaining('/primer-acceso/invitar'), { ids: [2] }]]))
  })

  it('invita a todos los que faltan después de preguntar', async () => {
    const usuario = userEvent.setup()
    const simulado = api()
    renderWithProviders(<VistaPrimerAcceso />)

    await usuario.click(await screen.findByRole('button', { name: 'Invitar a los que faltan (1)' }))
    await usuario.click(await screen.findByRole('button', { name: 'Mandar invitaciones' }))
    await waitFor(() => expect(posts(simulado)).toEqual([[expect.stringContaining('/primer-acceso/invitar'), {}]]))
    expect(await screen.findByText(/1 invitación en camino/)).toBeInTheDocument()
  })
})
