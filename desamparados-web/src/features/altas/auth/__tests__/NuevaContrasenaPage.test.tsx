import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import NuevaContrasenaPage from '../NuevaContrasenaPage'

const ok = (cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

const TOKEN = 'a'.repeat(64)

function SondaRuta() {
  return <div data-testid="ruta">{useLocation().pathname}</div>
}

function montar(entrada: string) {
  const router = createMemoryRouter([
    { path: '/reset-password', element: <NuevaContrasenaPage /> },
    { path: '*', element: <SondaRuta /> },
  ], { initialEntries: [entrada] })
  return render(<RouterProvider router={router} />)
}

afterEach(() => { vi.unstubAllGlobals() })

async function ponerContrasena() {
  const user = userEvent.setup()
  const [nueva, confirmar] = screen.getAllByLabelText(/contraseña/i, { selector: 'input' })
  await user.type(nueva, 'Hermano-Cambiada-2026')
  await user.type(confirmar, 'Hermano-Cambiada-2026')
  await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
}

// Quien la recupera desde la entrada del CMS vuelve a la del CMS: la de
// hermanos no es la suya y, sin área de hermanos, ni siquiera deja entrar.
describe('NuevaContrasenaPage', () => {
  it('con el enlace del CMS, al terminar lleva a la entrada del CMS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ message: 'ok' })))
    montar(`/reset-password?token=${TOKEN}&area=cms`)
    expect(screen.getByRole('link', { name: 'Volver al acceso' })).toHaveAttribute('href', '/cms/acceso')
    await ponerContrasena()
    expect(await screen.findByTestId('ruta', {}, { timeout: 4000 })).toHaveTextContent('/cms/acceso')
  })

  it('con el enlace de siempre, al terminar lleva a la entrada de hermanos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ message: 'ok' })))
    montar(`/reset-password?token=${TOKEN}`)
    await ponerContrasena()
    expect(await screen.findByTestId('ruta', {}, { timeout: 4000 })).toHaveTextContent(/^\/acceso$/)
  })

  it('pedida desde el CMS, la petición lo dice para que el correo traiga el enlace del CMS', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(ok({ message: 'ok' }))
    vi.stubGlobal('fetch', fetchFalso)
    montar('/reset-password?area=cms')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'secretaria@ejemplo.es')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    await screen.findByText(/recibirás un enlace/)
    const [, opciones] = fetchFalso.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(opciones.body))).toEqual({ email: 'secretaria@ejemplo.es', contexto: 'cms' })
  })
})
