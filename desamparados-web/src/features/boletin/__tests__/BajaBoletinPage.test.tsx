import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import BajaBoletinPage from '../BajaBoletinPage'

afterEach(() => { vi.unstubAllGlobals() })

describe('BajaBoletinPage', () => {
  it('no da de baja al abrir: hay que pulsar, y entonces sí', async () => {
    const user = userEvent.setup()
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Hecho: ya no recibirás el boletín.' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    renderWithProviders(<BajaBoletinPage />, { ruta: '/boletin/baja?t=abc.def' })

    expect(fetch).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Darme de baja del boletín' }))
    expect(await screen.findByText('Hecho: ya no recibirás el boletín.')).toBeInTheDocument()
    expect(JSON.parse(String((fetch.mock.calls[0][1] as RequestInit).body))).toEqual({ token: 'abc.def' })
  })

  it('sin enlace, lo dice', () => {
    renderWithProviders(<BajaBoletinPage />, { ruta: '/boletin/baja' })
    expect(screen.getByText(/Falta el enlace de baja/)).toBeInTheDocument()
  })
})
