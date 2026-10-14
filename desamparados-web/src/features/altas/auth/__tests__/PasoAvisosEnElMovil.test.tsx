import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import ActivarDobleFactor from '../ActivarDobleFactor'
import { useAuthStore } from '../store'

const tactil = vi.hoisted(() => ({ valor: false }))

vi.mock('../../../../lib/movilApuntado', async (original) => ({
  ...(await original<typeof import('../../../../lib/movilApuntado')>()),
  leerEsteMovil: async () => null,
  esPantallaTactil: () => tactil.valor,
}))

const ok = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const ADMIN = { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'cms' as const }

function mockPorUrl(rutas: Record<string, [unknown, number?]>) {
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, [cuerpo, status]] of Object.entries(rutas)) {
      if (url.includes(sufijo)) return ok(cuerpo, status)
    }
    return ok({}, 404)
  })
}

const activacion = {
  '/auth/2fa/generate': [{ qrCodeUrl: 'data:image/png;base64,qr', secret: 'JBSWY3DPEHPK3PXP' }],
  '/auth/2fa/enable': [{ message: '2FA activado.', backupCodes: ['AB2C-DEF4-GH56'] }],
  '/auth/me': [{ cms: { ...ADMIN, twoFactorEnabled: true }, hermano: null }],
} satisfies Record<string, [unknown, number?]>

/** Hasta los códigos de respaldo y «Los he guardado». */
async function activarYGuardar() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Empezar' }))
  await user.type(await screen.findByLabelText(/código de 6 dígitos/i), '123456')
  await user.click(screen.getByRole('button', { name: 'Activar' }))
  await user.click(await screen.findByRole('button', { name: /los he guardado/i }))
  return user
}

beforeEach(() => {
  tactil.valor = false
  useAuthStore.setState({ status: 'listo', cms: { ...ADMIN, twoFactorEnabled: false }, hermano: null })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('Activar el doble factor con los avisos en el móvil', () => {
  it('en el ordenador ofrece el QR al móvil y se puede dejar para luego', async () => {
    vi.stubGlobal('fetch', mockPorUrl({ ...activacion, '/auth/moviles': [{ disponible: true, clavePublica: 'BClave', moviles: [] }] }))
    renderWithProviders(<ActivarDobleFactor />, { modulos: ['avisos-en-el-movil'] })
    const user = await activarYGuardar()

    expect(await screen.findByRole('heading', { name: 'Avisos en el móvil' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /abrir «Mi seguridad» en el móvil/i })).toBeInTheDocument()
    // Aún no: ExigeRol quitaría esta pantalla antes de terminar.
    expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Ahora no, entrar en el CMS' }))
    await vi.waitFor(() => expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(true))
  })

  it('en el móvil ofrece apuntarlo ahí mismo', async () => {
    tactil.valor = true
    vi.stubGlobal('fetch', mockPorUrl({ ...activacion, '/auth/moviles': [{ disponible: true, clavePublica: 'BClave', moviles: [] }] }))
    renderWithProviders(<ActivarDobleFactor />, { modulos: ['avisos-en-el-movil'] })
    await activarYGuardar()

    expect(await screen.findByRole('heading', { name: 'Avisos en el móvil' })).toBeInTheDocument()
    // jsdom no sabe recibir avisos: lo dice en vez del formulario. Lo que importa es que no hay QR.
    expect(screen.queryByRole('img', { name: /abrir «Mi seguridad»/i })).not.toBeInTheDocument()
  })

  it('sin las claves del servidor, el paso no aparece y entra al CMS', async () => {
    vi.stubGlobal('fetch', mockPorUrl({ ...activacion, '/auth/moviles': [{ disponible: false, clavePublica: null, moviles: [] }] }))
    renderWithProviders(<ActivarDobleFactor />, { modulos: ['avisos-en-el-movil'] })
    await activarYGuardar()

    await vi.waitFor(() => expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(true))
    expect(screen.queryByRole('heading', { name: 'Avisos en el móvil' })).not.toBeInTheDocument()
  })

  it('con el módulo apagado, «Los he guardado» entra directo', async () => {
    const fetchMock = mockPorUrl(activacion)
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ActivarDobleFactor />, { modulos: [] })
    await activarYGuardar()

    await vi.waitFor(() => expect(useAuthStore.getState().cms?.twoFactorEnabled).toBe(true))
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/moviles'))).toBe(false)
  })
})
