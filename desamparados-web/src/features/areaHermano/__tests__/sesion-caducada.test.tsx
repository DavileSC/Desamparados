import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import theme from '../../../theme'
import { crearQueryClientDePruebas } from '../../../test/queryClient'
import VentanaSesionCaducada from '../../../app/VentanaSesionCaducada'
import ExigeSesion from '../../../routes/ExigeSesion'
import PerfilPage from '../perfil/PerfilPage'
import { FICHAS_POR_FAMILIA } from '../../../lib/api/perfil'
import { useAuthStore, type AuthUser } from '../../altas/auth/store'

// Fija lo que pasa cuando la sesión del área caduca (4 h fijas sin
// «Recuérdame») con Mi perfil a medias: antes el 401 vaciaba la sesión,
// ExigeSesion mandaba al acceso y lo escrito se perdía al pulsar Guardar.

const ana: AuthUser = { id: 5, email: 'ana@ejemplo.test', role: 'USER', perfiles: [], origen: 'hermanos' }
const ficha = {
  esTitular: true, parentesco: null, id: 1, nombre: 'Ana',
  apellidos: 'Pérez Ruiz', primerApellido: 'Pérez', segundoApellido: 'Ruiz',
  dni: '12345678Z', email: 'ana@ejemplo.test', email2: null, telefono: '600000000', telefonoFijo: null,
  direccion: 'Calle Mayor 1', poblacion: 'Málaga', codigoPostal: '29001', provincia: 'Málaga', pais: 'España',
  fechaAlta: '2020-03-01T00:00:00.000Z', fechaNacimiento: '1980-05-10T00:00:00.000Z', numeroHermano: 42, activo: true,
  sexo: 'MUJER', estadoCivil: null, profesion: null, lugarNacimiento: null, fechaBautismo: null, parroquiaBautismo: null,
  fechaJura: null, presentadoPor: null, presentadoPor2: null, tieneTunicaPropia: false, tunica: null, alturaHombro: null,
  puesto: null, formaPagoPref: 'EFECTIVO', ibanEnmascarado: null, titularCuenta: null,
}
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  useAuthStore.setState({ status: 'listo', cms: null, hermano: ana, cmsCaducada: false, hermanoCaducada: false })
})
afterEach(() => { vi.unstubAllGlobals() })

function montar(quienEntra: AuthUser = ana) {
  let sesionViva = true
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url)
    if (u.includes('/auth/me')) return Promise.resolve(json({ cms: null, hermano: sesionViva ? ana : null }))
    if (u.includes('/auth/login')) { sesionViva = true; return Promise.resolve(json({ status: 'OK', user: quienEntra })) }
    if (init?.method === 'PUT') {
      return Promise.resolve(sesionViva ? json({ message: 'ok', data: { ...ficha, ...JSON.parse(String(init.body)) } }) : json({ error: 'Token expirado' }, 401))
    }
    return Promise.resolve(json({ data: [ficha], meta: { total: 1, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 } }))
  })
  vi.stubGlobal('fetch', simulado)
  const router = createMemoryRouter(
    [
      { path: '/acceso', element: <p>pantalla de acceso</p> },
      { path: '/area-hermano/perfil', element: <ExigeSesion><PerfilPage /><VentanaSesionCaducada area="hermanos" /></ExigeSesion> },
    ],
    { initialEntries: ['/area-hermano/perfil?apartado=contacto'] },
  )
  render(<QueryClientProvider client={crearQueryClientDePruebas()}><HelmetProvider><ThemeProvider theme={theme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider></QueryClientProvider>)
  return { simulado, caducar: () => { sesionViva = false } }
}

describe('la sesión del área de hermanos caduca con Mi perfil a medias', () => {
  it('no se pierde lo escrito: se vuelve a entrar en una ventana y se guarda', async () => {
    const user = userEvent.setup()
    const { caducar, simulado } = montar()
    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar contacto y domicilio/i }))
    await user.type(screen.getByLabelText('Teléfono fijo'), '952 12 34 56')
    caducar()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    // La ventana para volver a entrar, con Mi perfil y lo escrito detrás.
    const ventana = await screen.findByRole('dialog', { name: 'Tu sesión ha caducado' })
    expect(screen.queryByText('pantalla de acceso')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('952 12 34 56')).toBeInTheDocument()
    expect(within(ventana).getByLabelText(/email/i)).toHaveValue('ana@ejemplo.test')

    await user.type(within(ventana).getByLabelText(/contraseña/i, { selector: 'input' }), 'Desamparados2026')
    await user.click(within(ventana).getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useAuthStore.getState().hermanoCaducada).toBe(false)

    // Ya dentro, se vuelve a pulsar y se guarda lo que había.
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(simulado.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toHaveLength(2))
    const put = simulado.mock.calls.findLast(([, init]) => (init as RequestInit | undefined)?.method === 'PUT') as [string, RequestInit]
    expect(JSON.parse(String(put[1].body)).telefonoFijo).toBe('952123456')
  })

  it('«Salir del área» deja la pantalla y lleva al acceso', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('Ana Pérez Ruiz')
    useAuthStore.setState({ hermanoCaducada: true })

    const ventana = await screen.findByRole('dialog', { name: 'Tu sesión ha caducado' })
    await user.click(within(ventana).getByRole('button', { name: 'Salir del área' }))
    expect(await screen.findByText('pantalla de acceso')).toBeInTheDocument()
  })

  it('si entra otra cuenta, se carga su área desde cero sin preguntar por lo que dejó la anterior', async () => {
    // jsdom no navega: basta con ver adónde se manda.
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const user = userEvent.setup()
    const luis: AuthUser = { ...ana, id: 6, email: 'luis@ejemplo.test' }
    const { caducar } = montar(luis)
    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar contacto y domicilio/i }))
    await user.type(screen.getByLabelText('Teléfono fijo'), '952 12 34 56')
    caducar()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const ventana = await screen.findByRole('dialog', { name: 'Tu sesión ha caducado' })
    // Con lo de Ana a medias, el navegador preguntaría antes de salir.
    const antes = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(antes)
    expect(antes.defaultPrevented).toBe(true)

    await user.clear(within(ventana).getByLabelText(/email/i))
    await user.type(within(ventana).getByLabelText(/email/i), 'luis@ejemplo.test')
    await user.type(within(ventana).getByLabelText(/contraseña/i, { selector: 'input' }), 'Desamparados2026')
    await user.click(within(ventana).getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/area-hermano'))
    expect(useAuthStore.getState().hermano?.id).toBe(6)
    // Y la recarga ya no pregunta: no hay «Quedarse» que deje el formulario
    // de Ana en pantalla con la sesión de Luis.
    const despues = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(despues)
    expect(despues.defaultPrevented).toBe(false)
  })

  it('quien entra sin sesión sigue yendo directo al acceso, sin ventana', async () => {
    useAuthStore.setState({ hermano: null })
    montar()
    expect(await screen.findByText('pantalla de acceso')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
