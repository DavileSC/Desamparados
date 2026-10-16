import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../../test/test-utils'
import CuentaPage from '../CuentaPage'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

/** La pantalla con una salida a otra del área y la dirección a la vista, para ver si se sale o no. */
function ConSalida() {
  const { pathname } = useLocation()
  return (
    <>
      <CuentaPage />
      <Link to="/area-hermano/perfil">Mi perfil</Link>
      <span data-testid="donde">{pathname}</span>
    </>
  )
}

afterEach(() => { vi.unstubAllGlobals() })

describe('CuentaPage: cambiar la contraseña', () => {
  const conCuerpo = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

  /** El cambio de contraseña y /auth/me, con lo que se pida; lo demás, vacío. */
  function simular(cambio: () => Response) {
    const simulado = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/auth/cambiar-contrasena')) return Promise.resolve(cambio())
      if (String(url).includes('/auth/me')) return Promise.resolve(conCuerpo({ cms: null, hermano: { id: 1, email: 'ana@ejemplo.test', role: 'HERMANO', perfiles: [] } }))
      return Promise.resolve(json({ data: null }))
    })
    vi.stubGlobal('fetch', simulado)
    return simulado
  }
  const llamadasA = (simulado: ReturnType<typeof simular>, ruta: string) => simulado.mock.calls.filter(([url]) => String(url).includes(ruta))

  async function rellenar(user: ReturnType<typeof userEvent.setup>, nueva = 'Otra-Clave-2026-Larga', repetida = nueva) {
    await user.click(await screen.findByRole('button', { name: 'Cambiar' }))
    await user.type(screen.getByLabelText('Contraseña actual'), 'La-De-Antes-2025')
    await user.type(screen.getByLabelText('Contraseña nueva'), nueva)
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), repetida)
    await user.click(screen.getByRole('button', { name: 'Cambiar la contraseña' }))
  }

  it('manda la actual y la nueva, enseña el mensaje y vuelve a pedir las sesiones', async () => {
    const user = userEvent.setup()
    const simulado = simular(() => conCuerpo({ message: 'Contraseña cambiada. Se han cerrado las sesiones abiertas en otros dispositivos.' }))
    renderWithProviders(<ConSalida />, { routerDeDatos: true, ruta: '/area-hermano/cuenta' })
    await rellenar(user)

    expect(await screen.findByText(/Contraseña cambiada/)).toBeInTheDocument()
    const [[, init]] = llamadasA(simulado, '/auth/cambiar-contrasena')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ actual: 'La-De-Antes-2025', nueva: 'Otra-Clave-2026-Larga' })
    // Las cookies son nuevas: lo que sabía la web de las sesiones era de antes del corte.
    await waitFor(() => expect(llamadasA(simulado, '/auth/me')).toHaveLength(1))
  })

  it('no manda nada si la nueva no se repite igual', async () => {
    const user = userEvent.setup()
    const simulado = simular(() => conCuerpo({ message: 'ok' }))
    renderWithProviders(<ConSalida />, { routerDeDatos: true, ruta: '/area-hermano/cuenta' })
    await rellenar(user, 'Otra-Clave-2026-Larga', 'Otra-Clave-2026-Larg')

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(llamadasA(simulado, '/auth/cambiar-contrasena')).toHaveLength(0)
  })

  it('la actual equivocada (400) se dice, y no se toma por una sesión caducada', async () => {
    const user = userEvent.setup()
    const simulado = simular(() => conCuerpo({ error: 'La contraseña actual no es correcta.' }, 400))
    renderWithProviders(<ConSalida />, { routerDeDatos: true, ruta: '/area-hermano/cuenta' })
    await rellenar(user)

    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument()
    // Un 401 haría que la web preguntara por las sesiones; un 400 no.
    expect(llamadasA(simulado, '/auth/me')).toHaveLength(0)
  })

  it('con algo escrito en la contraseña, salir de la pantalla pregunta antes y no lo pierde', async () => {
    const user = userEvent.setup()
    simular(() => conCuerpo({ message: 'ok' }))
    renderWithProviders(<ConSalida />, { routerDeDatos: true, ruta: '/area-hermano/cuenta' })
    await user.click(await screen.findByRole('button', { name: 'Cambiar' }))
    // Basta con uno de los tres campos: la repetición sola también es trabajo.
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'Otra')
    await user.click(screen.getByRole('link', { name: 'Mi perfil' }))

    expect(await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Repite la contraseña nueva')).toHaveValue('Otra')
    expect(screen.getByTestId('donde')).toHaveTextContent('/area-hermano/cuenta')
  })

  it('con la contraseña abierta pero vacía, salir no pregunta', async () => {
    const user = userEvent.setup()
    simular(() => conCuerpo({ message: 'ok' }))
    renderWithProviders(<ConSalida />, { routerDeDatos: true, ruta: '/area-hermano/cuenta' })
    await user.click(await screen.findByRole('button', { name: 'Cambiar' }))
    await user.click(screen.getByRole('link', { name: 'Mi perfil' }))
    expect(screen.getByTestId('donde')).toHaveTextContent('/area-hermano/perfil')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el error de un campo va bajo su casilla', async () => {
    const user = userEvent.setup()
    simular(() => conCuerpo({ error: 'Error de validación', errors: [{ field: 'nueva', message: 'La contraseña es demasiado común' }] }, 400))
    renderWithProviders(<ConSalida />, { routerDeDatos: true, ruta: '/area-hermano/cuenta' })
    await rellenar(user)

    expect(await screen.findByText('La contraseña es demasiado común')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('aria-invalid', 'true')
  })
})
