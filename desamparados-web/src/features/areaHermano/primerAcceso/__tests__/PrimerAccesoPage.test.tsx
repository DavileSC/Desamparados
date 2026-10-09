import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import PrimerAccesoPage from '../PrimerAccesoPage'
import { useAuthStore } from '../../../altas/auth/store'

const TOKEN = 'a'.repeat(64)
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { useAuthStore.setState({ status: 'listo', cms: null, hermano: null }) })
afterEach(() => { vi.unstubAllGlobals() })

describe('PrimerAccesoPage', () => {
  it('saluda por el nombre, pone la contraseña y deja la sesión abierta', async () => {
    const usuario = userEvent.setup()
    const simulado = vi.fn().mockImplementation((url: string) => Promise.resolve(String(url).endsWith('/primer-acceso/datos')
      ? json({ nombre: 'Antonio', email: 'antonio@ejemplo.test' })
      : json({ status: 'OK', user: { id: 7, email: 'antonio@ejemplo.test', role: 'USER', perfiles: [], primerAccesoPendiente: true, origen: 'hermanos' } })))
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<PrimerAccesoPage />, { ruta: `/primer-acceso?token=${TOKEN}` })

    expect(await screen.findByRole('heading', { name: 'Te damos la bienvenida, Antonio' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Tu correo/ })).toHaveValue('antonio@ejemplo.test')
    await usuario.type(screen.getByLabelText('Crea tu contraseña'), 'Trono-Alameda-84-Verde')
    await usuario.click(screen.getByRole('button', { name: 'Empezar' }))

    await waitFor(() => expect(useAuthStore.getState().hermano?.id).toBe(7))
    const estreno = simulado.mock.calls.find(([url]) => String(url).endsWith('/auth/primer-acceso'))
    expect(JSON.parse(String((estreno![1] as RequestInit).body))).toMatchObject({ token: TOKEN, newPassword: 'Trono-Alameda-84-Verde' })
  })

  it('con un enlace caducado manda a entrar o a pedir otro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ error: 'El enlace de la invitación no es válido o ha caducado.' }, 400))))
    renderWithProviders(<PrimerAccesoPage />, { ruta: `/primer-acceso?token=${TOKEN}` })

    expect(await screen.findByRole('heading', { name: 'El enlace ya no vale' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute('href', '/reset-password')
  })

  it('sin enlace no pregunta nada al servidor', () => {
    const simulado = vi.fn()
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<PrimerAccesoPage />, { ruta: '/primer-acceso' })
    expect(screen.getByRole('heading', { name: 'El enlace ya no vale' })).toBeInTheDocument()
    expect(simulado.mock.calls.filter(([url]) => String(url).includes('primer-acceso'))).toHaveLength(0)
  })
})
