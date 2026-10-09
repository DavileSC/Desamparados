import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import ActivarDobleFactor from '../ActivarDobleFactor'
import { useAuthStore } from '../store'

const ok = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const ADMIN = { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms' as const }

/** Responde por URL: activar encadena generate → enable → me. */
function mockPorUrl(rutas: Record<string, [unknown, number?]>) {
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, [cuerpo, status]] of Object.entries(rutas)) {
      if (url.includes(sufijo)) return ok(cuerpo, status)
    }
    return ok({}, 404)
  })
}

beforeEach(() => {
  useAuthStore.setState({ status: 'listo', cms: { ...ADMIN, twoFactorEnabled: false }, hermano: null })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('ActivarDobleFactor', () => {
  it('QR, código y respaldos; la sesión se pone al día solo al pulsar «Los he guardado»', async () => {
    const fetchMock = mockPorUrl({
      '/auth/2fa/generate': [{ qrCodeUrl: 'data:image/png;base64,qr', secret: 'JBSWY3DPEHPK3PXP' }],
      '/auth/2fa/enable': [{ message: '2FA activado.', backupCodes: ['AB2C-DEF4-GH56', 'IJ8K-LM6N-OP3Q'] }],
      '/auth/me': [{ cms: { ...ADMIN, twoFactorEnabled: true }, hermano: null }],
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<ActivarDobleFactor />)
    const user = userEvent.setup()

    expect(screen.getByRole('heading', { name: /activa el doble factor/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(await screen.findByRole('img', { name: /qr/i })).toBeInTheDocument()
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()

    // Genera y guarda un secreto nuevo: el backend ya no lo sirve por GET.
    const generar = fetchMock.mock.calls.find((c) => String(c[0]).includes('/auth/2fa/generate'))
    expect(generar?.[1]?.method).toBe('POST')

    await user.type(screen.getByLabelText(/código de 6 dígitos/i), '123456')
    await user.click(screen.getByRole('button', { name: 'Activar' }))

    expect(await screen.findByText(/solo se muestran esta vez/i)).toBeInTheDocument()
    expect(screen.getByText('AB2C-DEF4-GH56')).toBeInTheDocument()
    // Si el store se enterase ya, ExigeRol quitaría esta pantalla con los códigos.
    expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(false)

    await user.click(screen.getByRole('button', { name: /los he guardado/i }))
    await vi.waitFor(() => expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(true))
  })

  it('un código erróneo se ve en pantalla y no avanza', async () => {
    vi.stubGlobal('fetch', mockPorUrl({
      '/auth/2fa/generate': [{ qrCodeUrl: 'data:image/png;base64,qr', secret: 'JBSWY3DPEHPK3PXP' }],
      '/auth/2fa/enable': [{ message: 'Código incorrecto.' }, 400],
    }))

    renderWithProviders(<ActivarDobleFactor />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    await screen.findByRole('img', { name: /qr/i })
    await user.type(screen.getByLabelText(/código de 6 dígitos/i), '000000')
    await user.click(screen.getByRole('button', { name: 'Activar' }))

    expect(await screen.findByText('Código incorrecto.')).toBeInTheDocument()
    expect(screen.queryByText(/los he guardado/i)).not.toBeInTheDocument()
  })

  it('si ya lo activó en otra pestaña, la sesión se pone al día sin enseñar el error', async () => {
    vi.stubGlobal('fetch', mockPorUrl({
      '/auth/2fa/generate': [{ error: 'El doble factor ya está activo.' }, 409],
      '/auth/me': [{ cms: { ...ADMIN, twoFactorEnabled: true }, hermano: null }],
    }))

    renderWithProviders(<ActivarDobleFactor />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Empezar' }))

    await vi.waitFor(() => expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(true))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
