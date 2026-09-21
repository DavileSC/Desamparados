import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import AccesoPage from '../AccesoPage'
import { useAuthStore } from '../store'

const ok = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** Pinta la ruta actual: así se comprueba a dónde manda el login sin montar el CMS entero. */
function SondaRuta() {
  const location = useLocation()
  return <div data-testid="ruta">{location.pathname}</div>
}

beforeEach(() => {
  useAuthStore.setState({ status: 'listo', cms: null, hermano: null })
})

afterEach(() => { vi.unstubAllGlobals() })

function montar() {
  const router = createMemoryRouter([
    { path: '/hermanos/acceso', element: <AccesoPage /> },
    { path: '*', element: <SondaRuta /> },
  ], { initialEntries: ['/hermanos/acceso'] })
  return render(<RouterProvider router={router} />)
}

describe('AccesoPage (acceso de hermanos)', () => {
  it('un hermano entra y aterriza en su área', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      ok({ status: 'OK', user: { id: 5, email: 'h@cofradia.com', role: 'USER', perfiles: [], origen: 'hermanos' } }),
    ))

    montar()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'hermano@cofradia.com')
    await user.type(screen.getByLabelText(/contraseña/i, { selector: 'input' }), 'Desamparados2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByTestId('ruta')).toHaveTextContent('/area-hermano')
    expect(useAuthStore.getState().hermano?.role).toBe('USER')
  })

  it('un cargo también entra por aquí y aterriza en el área de hermanos, sin sesión de CMS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      ok({ status: 'OK', user: { id: 1, email: 'admin@cofradia.com', role: 'ADMIN', perfiles: [], origen: 'hermanos' } }),
    ))

    montar()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'admin@cofradia.com')
    await user.type(screen.getByLabelText(/contraseña/i, { selector: 'input' }), 'Desamparados2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByTestId('ruta')).toHaveTextContent('/area-hermano')
    expect(useAuthStore.getState().hermano?.role).toBe('ADMIN')
    expect(useAuthStore.getState().cms).toBeNull()
  })

  it('ofrece "recordarme" y manda contexto hermanos en el cuerpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({ status: 'OK', user: { id: 5, email: 'h@cofradia.com', role: 'USER', perfiles: [], origen: 'hermanos' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    montar()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'hermano@cofradia.com')
    await user.type(screen.getByLabelText(/contraseña/i, { selector: 'input' }), 'Desamparados2026')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByTestId('ruta')).toHaveTextContent('/area-hermano')
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(cuerpo.recordarme).toBe(true)
    expect(cuerpo.contexto).toBe('hermanos')
  })

  it('quien ya tiene sesión de hermano no ve el formulario: directo al área', () => {
    useAuthStore.setState({
      status: 'listo',
      cms: null,
      hermano: { id: 5, email: 'h@cofradia.com', role: 'USER', perfiles: [], origen: 'hermanos' },
    })

    montar()

    expect(screen.getByTestId('ruta')).toHaveTextContent('/area-hermano')
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
  })
})
