import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import MiSeguridadPage from '../MiSeguridadPage'
import { useAuthStore } from '../../altas/auth/store'

const ok = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

// Aquí siempre está activo: sin él, ExigeRol enseña la pantalla de activación.
const cuenta = { twoFactorEnabled: true }

/** Responde por URL: cambiar de móvil encadena disable → me. */
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
  it('el doble factor está activado y se ofrece cambiar de móvil', () => {
    renderWithProviders(<MiSeguridadPage />)
    expect(screen.getByRole('heading', { name: /mi seguridad/i })).toBeInTheDocument()
    expect(screen.getByText('Activado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cambiar de móvil/i })).toBeDisabled()
    // Activarlo ya no se hace aquí: es obligatorio y lo pide la pantalla de entrada.
    expect(screen.queryByRole('button', { name: /activar/i })).not.toBeInTheDocument()
  })

  it('cambiar de móvil pide confirmación y un código vigente, y deja la cuenta pendiente de activarlo', async () => {
    const fetchMock = mockPorUrl({
      '/auth/2fa/disable': { message: '2FA desactivado.' },
      '/auth/me': { cms: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms', twoFactorEnabled: false }, hermano: null },
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<MiSeguridadPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/código de verificación/i), '654321')
    await user.click(screen.getByRole('button', { name: /cambiar de móvil/i }))

    // Pregunta antes de dar el paso.
    expect(screen.getByText(/¿cambiar de móvil\?/i)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/2fa/disable'))).toBe(false)
    await user.click(screen.getAllByRole('button', { name: /cambiar de móvil/i }).at(-1)!)

    const baja = fetchMock.mock.calls.find((c) => String(c[0]).includes('/auth/2fa/disable'))
    expect(JSON.parse(String(baja?.[1]?.body))).toEqual({ token2fa: '654321' })
    // Con el store al día, ExigeRol cambia la pantalla por la de activación.
    await vi.waitFor(() => expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(false))
  })

  it('un código erróneo al cambiar de móvil se ve en pantalla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => ok({ message: 'Código incorrecto.' }, 400)))

    renderWithProviders(<MiSeguridadPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/código de verificación/i), '000000')
    await user.click(screen.getByRole('button', { name: /cambiar de móvil/i }))
    await user.click(screen.getAllByRole('button', { name: /cambiar de móvil/i }).at(-1)!)

    expect(await screen.findByText('Código incorrecto.')).toBeInTheDocument()
    expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(true)
  })

  it('cambia la contraseña y vuelve a pedir las sesiones, que el servidor ha renovado', async () => {
    const fetchMock = mockPorUrl({
      '/auth/cambiar-contrasena': { message: 'Contraseña cambiada. Se han cerrado las sesiones abiertas en otros dispositivos.' },
      '/auth/me': { cms: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms', twoFactorEnabled: true }, hermano: null },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<MiSeguridadPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Contraseña actual'), 'La-De-Antes-2025')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'Otra-Clave-2026-Larga')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'Otra-Clave-2026-Larga')
    await user.click(screen.getByRole('button', { name: 'Cambiar la contraseña' }))

    expect(await screen.findByText(/Contraseña cambiada/)).toBeInTheDocument()
    const cambio = fetchMock.mock.calls.find((c) => String(c[0]).includes('/auth/cambiar-contrasena'))
    expect(JSON.parse(String(cambio?.[1]?.body))).toEqual({ actual: 'La-De-Antes-2025', nueva: 'Otra-Clave-2026-Larga' })
    await vi.waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/me'))).toBe(true))
    // Un cambio de contraseña no cierra la sesión del CMS de quien lo hace.
    expect(useAuthStore.getState().cms).not.toBeNull()
  })
})

