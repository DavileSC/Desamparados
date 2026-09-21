import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import MiSeguridadPage from '../MiSeguridadPage'
import { useAuthStore } from '../../altas/auth/store'

const ok = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const cuenta = { twoFactorEnabled: false }

/** Responde por URL: activar encadena generate → enable → me. */
function mockPorUrl(rutas: Record<string, unknown>) {
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, cuerpo] of Object.entries(rutas)) {
      if (url.includes(sufijo)) return ok(cuerpo)
    }
    return ok({}, 404)
  })
}

beforeEach(() => {
  useAuthStore.setState({
    status: 'listo',
    cms: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms', ...cuenta },
    hermano: null,
  })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('MiSeguridadPage', () => {
  it('con el 2FA apagado ofrece activarlo', () => {
    renderWithProviders(<MiSeguridadPage />)
    expect(screen.getByRole('heading', { name: /mi seguridad/i })).toBeInTheDocument()
    expect(screen.getByText('Desactivado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activar 2fa/i })).toBeInTheDocument()
  })

  it('activar: QR, código y respaldos en claro una sola vez', async () => {
    const fetchMock = mockPorUrl({
      '/auth/2fa/generate': { qrCodeUrl: 'data:image/png;base64,qr', secret: 'JBSWY3DPEHPK3PXP' },
      '/auth/2fa/enable': { message: '2FA activado.', backupCodes: ['AB2C-DEF4-GH56', 'IJ8K-LM6N-OP3Q'] },
      '/auth/me': { cms: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms', twoFactorEnabled: true }, hermano: null },
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<MiSeguridadPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /activar 2fa/i }))
    expect(await screen.findByRole('img', { name: /qr/i })).toBeInTheDocument()
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()

    // Genera y guarda un secreto nuevo: el backend ya no lo sirve por GET.
    const generar = fetchMock.mock.calls.find((c) => String(c[0]).includes('/auth/2fa/generate'))
    expect(generar?.[1]?.method).toBe('POST')

    await user.type(screen.getByLabelText(/código de 6 dígitos/i), '123456')
    await user.click(screen.getByRole('button', { name: 'Activar' }))

    // Los respaldos se muestran UNA vez, con su aviso.
    expect(await screen.findByText(/solo se muestran esta vez/i)).toBeInTheDocument()
    expect(screen.getByText('AB2C-DEF4-GH56')).toBeInTheDocument()
    expect(screen.getByText('IJ8K-LM6N-OP3Q')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /los he guardado/i }))
    expect(await screen.findByText('Activado')).toBeInTheDocument()
    expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(true)
  })

  it('un código erróneo en la activación se ve en pantalla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/auth/2fa/generate')) {
        return ok({ qrCodeUrl: 'data:image/png;base64,qr', secret: 'JBSWY3DPEHPK3PXP' })
      }
      if (url.includes('/auth/2fa/enable')) {
        // El backend rechaza el código con 401 y su mensaje de negocio.
        return ok({ message: 'Código incorrecto.' }, 401)
      }
      return ok({}, 404)
    }))

    renderWithProviders(<MiSeguridadPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /activar 2fa/i }))
    await screen.findByRole('img', { name: /qr/i })
    await user.type(screen.getByLabelText(/código de 6 dígitos/i), '000000')
    await user.click(screen.getByRole('button', { name: 'Activar' }))

    expect(await screen.findByText('Código incorrecto.')).toBeInTheDocument()
    // No hay respaldos que mostrar: el flujo no avanzó.
    expect(screen.queryByText(/los he guardado/i)).not.toBeInTheDocument()
  })

  it('si el servidor dice que ya está activo, lo explica y la pantalla se pone al día', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/auth/2fa/generate')) {
        return ok({ error: 'El doble factor ya está activo. Desactívalo primero si quieres configurarlo con otro móvil.' }, 409)
      }
      if (url.includes('/auth/me')) {
        return ok({ cms: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms', twoFactorEnabled: true }, hermano: null })
      }
      return ok({}, 404)
    }))

    renderWithProviders(<MiSeguridadPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /activar 2fa/i }))

    expect(await screen.findByText(/desactívalo primero/i)).toBeInTheDocument()
    // Sin QR que escanear, y con el estado real de la cuenta.
    expect(screen.queryByRole('img', { name: /qr/i })).not.toBeInTheDocument()
    expect(await screen.findByText('Activado')).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('listo')
  })

  it('desactivar pide confirmación y código vigente', async () => {
    useAuthStore.setState({
      status: 'listo',
      cms: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms', twoFactorEnabled: true },
      hermano: null,
    })
    vi.stubGlobal('fetch', mockPorUrl({
      '/auth/2fa/disable': { message: '2FA desactivado.' },
      '/auth/me': { cms: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms', twoFactorEnabled: false }, hermano: null },
    }))

    renderWithProviders(<MiSeguridadPage />)
    const user = userEvent.setup()

    expect(screen.getByText('Activado')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/código de verificación/i), '654321')

    const boton = screen.getByRole('button', { name: /desactivar 2fa/i })
    await user.click(boton)

    // Pregunta antes de dar el paso, y es un paso peligroso.
    expect(screen.getByText(/¿desactivar el doble factor\?/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desactivar' }))

    expect(await screen.findByText(/vuelve a entrar solo con contraseña/i)).toBeInTheDocument()
    expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(false)
  })
})
