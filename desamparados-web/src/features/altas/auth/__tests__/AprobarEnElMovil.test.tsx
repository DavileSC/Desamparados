import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import AccesoCmsPage from '../AccesoCmsPage'
import { useAuthStore } from '../store'

const movilGuardado = vi.hoisted(() => ({ valor: null as null | { dispositivo: number; clave: string; nombre: string } }))
const olvidar = vi.hoisted(() => vi.fn())

vi.mock('../../../../lib/movilApuntado', async (original) => ({
  ...(await original<typeof import('../../../../lib/movilApuntado')>()),
  leerEsteMovil: async () => movilGuardado.valor,
  olvidarEsteMovil: olvidar,
}))

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Cada ruta con sus respuestas en orden (la última se repite). La más larga
 * primero: '/auth/login' también está dentro de '/auth/login/aprobacion'.
 */
function mockEnOrden(rutas: Record<string, { cuerpo: unknown; status?: number }[]>) {
  const ordenadas = Object.entries(rutas).sort(([a], [b]) => b.length - a.length)
  const vistas = new Map<string, number>()
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, lista] of ordenadas) {
      if (!url.includes(sufijo)) continue
      const n = vistas.get(sufijo) ?? 0
      vistas.set(sufijo, n + 1)
      const { cuerpo, status } = lista[Math.min(n, lista.length - 1)]
      return respuesta(cuerpo, status)
    }
    return respuesta({}, 404)
  })
}

const usuario = { id: 1, email: 'secretaria@cofradia.com', role: 'SECRETARIA', perfiles: [], origen: 'cms' }

const conAprobacion = {
  cuerpo: {
    status: '2FA_NEEDED',
    message: 'Aprueba la entrada en tu móvil o escribe el código de tu aplicación de autenticación.',
    aprobacion: { numero: 47, expiraEn: new Date(Date.now() + 120_000).toISOString() },
  },
}

function montar() {
  const router = createMemoryRouter([
    { path: '/cms/acceso', element: <AccesoCmsPage /> },
    { path: '/cms', element: <div>panel del cms</div> },
  ], { initialEntries: ['/cms/acceso'] })
  return render(<RouterProvider router={router} />)
}

async function entrar() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.type(screen.getByLabelText(/email/i), 'secretaria@cofradia.com')
  await user.type(screen.getByLabelText(/contraseña/i, { selector: 'input' }), 'Desamparados2026')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  return user
}

/** Deja pasar una vuelta de la espera (pregunta cada 2 s). */
const otraPregunta = () => vi.advanceTimersByTimeAsync(2100)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  movilGuardado.valor = null
  olvidar.mockReset()
  useAuthStore.setState({ status: 'listo', cms: null, hermano: null })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Aprobar la entrada desde el móvil, en el acceso del CMS', () => {
  it('enseña el número, espera y entra cuando el móvil aprueba', async () => {
    vi.stubGlobal('fetch', mockEnOrden({
      '/auth/login': [conAprobacion],
      '/auth/login/aprobacion': [{ cuerpo: { estado: 'PENDIENTE' } }, { cuerpo: { estado: 'APROBADA', status: 'OK', user: usuario } }],
    }))
    montar()
    await entrar()

    expect(await screen.findByLabelText('Número: 47')).toBeInTheDocument()
    await otraPregunta()
    expect(screen.queryByText('panel del cms')).not.toBeInTheDocument()
    await otraPregunta()
    expect(await screen.findByText('panel del cms')).toBeInTheDocument()
    expect(useAuthStore.getState().cms?.role).toBe('SECRETARIA')
  })

  it('un número fallado en el móvil pasa al código de la app y dice por qué', async () => {
    vi.stubGlobal('fetch', mockEnOrden({
      '/auth/login': [conAprobacion],
      '/auth/login/aprobacion': [{ cuerpo: { estado: 'FALLADA' } }],
    }))
    montar()
    await entrar()

    await screen.findByLabelText('Número: 47')
    await otraPregunta()
    expect(await screen.findByLabelText(/código de verificación/i)).toBeInTheDocument()
    expect(screen.getByText(/se eligió otro número/i)).toBeInTheDocument()
  })

  it('caducada, también al código', async () => {
    vi.stubGlobal('fetch', mockEnOrden({
      '/auth/login': [conAprobacion],
      '/auth/login/aprobacion': [{ cuerpo: { estado: 'CADUCADA' } }],
    }))
    montar()
    await entrar()

    await screen.findByLabelText('Número: 47')
    await otraPregunta()
    expect(await screen.findByText(/ha caducado sin aprobarse/i)).toBeInTheDocument()
  })

  it('rechazada desde el móvil, vuelve a la contraseña', async () => {
    vi.stubGlobal('fetch', mockEnOrden({
      '/auth/login': [conAprobacion],
      '/auth/login/aprobacion': [{ cuerpo: { estado: 'RECHAZADA' } }],
    }))
    montar()
    await entrar()

    await screen.findByLabelText('Número: 47')
    await otraPregunta()
    expect(await screen.findByText(/se ha rechazado desde el móvil/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('con el módulo apagado a media espera, pasa sola al código', async () => {
    vi.stubGlobal('fetch', mockEnOrden({
      '/auth/login': [conAprobacion],
      '/auth/login/aprobacion': [{ status: 404, cuerpo: { error: 'MODULO_NO_ACTIVADO', message: 'No activado' } }],
    }))
    montar()
    await entrar()

    await screen.findByLabelText('Número: 47')
    await otraPregunta()
    expect(await screen.findByLabelText(/código de verificación/i)).toBeInTheDocument()
  })

  it('«Usar el código de la app» deja de esperar en el acto', async () => {
    const fetchMock = mockEnOrden({
      '/auth/login': [conAprobacion],
      '/auth/login/aprobacion': [{ cuerpo: { estado: 'PENDIENTE' } }],
    })
    vi.stubGlobal('fetch', fetchMock)
    montar()
    const user = await entrar()

    await screen.findByLabelText('Número: 47')
    await user.click(screen.getByRole('button', { name: 'Usar el código de la app' }))
    expect(await screen.findByLabelText(/código de verificación/i)).toBeInTheDocument()

    // Ya no pregunta: la espera se desmontó con su temporizador.
    const preguntas = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/login/aprobacion')).length
    const antes = preguntas()
    await otraPregunta()
    await otraPregunta()
    expect(preguntas()).toBe(antes)
  })

  it('desde el mismo móvil apuntado: dice cuál es al login y aprueba ahí mismo', async () => {
    movilGuardado.valor = { dispositivo: 7, clave: 'clave-del-movil', nombre: 'iPhone de Ana' }
    const fetchMock = mockEnOrden({
      '/auth/login': [{ cuerpo: { status: '2FA_NEEDED', message: 'Introduce el código.', esteMovil: true } }],
      '/auth/login/este-movil': [{ cuerpo: { status: 'OK', user: usuario } }],
    })
    vi.stubGlobal('fetch', fetchMock)
    montar()
    const user = await entrar()

    expect(await screen.findByText('iPhone de Ana')).toBeInTheDocument()
    const login = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(login.dispositivo).toBe(7)

    await user.click(screen.getByRole('button', { name: 'Aprobar entrada en este móvil' }))
    expect(await screen.findByText('panel del cms')).toBeInTheDocument()
    const llamada = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/login/este-movil'))!
    expect(JSON.parse(llamada[1].body as string)).toEqual({ dispositivo: 7, clave: 'clave-del-movil' })
  })

  it('un móvil que ya no está apuntado olvida su clave y pasa al código', async () => {
    movilGuardado.valor = { dispositivo: 7, clave: 'clave-del-movil', nombre: 'iPhone de Ana' }
    vi.stubGlobal('fetch', mockEnOrden({
      '/auth/login': [{ cuerpo: { status: '2FA_NEEDED', message: 'Introduce el código.', esteMovil: true } }],
      '/auth/login/este-movil': [{ status: 403, cuerpo: { codigo: 'MOVIL_NO_APUNTADO', message: 'Este móvil ya no está apuntado.' } }],
    }))
    montar()
    const user = await entrar()

    await user.click(await screen.findByRole('button', { name: 'Aprobar entrada en este móvil' }))
    expect(await screen.findByLabelText(/código de verificación/i)).toBeInTheDocument()
    expect(olvidar).toHaveBeenCalled()
  })
})
