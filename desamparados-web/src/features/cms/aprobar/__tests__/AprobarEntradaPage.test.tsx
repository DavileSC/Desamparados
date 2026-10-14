import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import AprobarEntradaPage from '../AprobarEntradaPage'

const movilGuardado = vi.hoisted(() => ({ valor: null as null | { dispositivo: number; clave: string; nombre: string } }))
const olvidar = vi.hoisted(() => vi.fn())

vi.mock('../../../../lib/movilApuntado', async (original) => ({
  ...(await original<typeof import('../../../../lib/movilApuntado')>()),
  leerEsteMovil: async () => movilGuardado.valor,
  olvidarEsteMovil: olvidar,
}))

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** La más larga primero: la ruta de ver está dentro de las de aprobar y rechazar. */
function mockPorUrl(rutas: Record<string, { cuerpo: unknown; status?: number }>) {
  const ordenadas = Object.entries(rutas).sort(([a], [b]) => b.length - a.length)
  return vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    for (const [sufijo, { cuerpo, status }] of ordenadas) {
      if (url.includes(sufijo)) return respuesta(cuerpo, status)
    }
    return respuesta({}, 404)
  })
}

const pendiente = {
  cuerpo: { estado: 'PENDIENTE', opciones: [18, 47, 83], desde: 'Windows · Chrome', expiraEn: new Date(Date.now() + 120_000).toISOString() },
}

function montar() {
  const router = createMemoryRouter([
    { path: '/cms/aprobar/:id', element: <AprobarEntradaPage /> },
  ], { initialEntries: ['/cms/aprobar/abc123'] })
  return render(<HelmetProvider><RouterProvider router={router} /></HelmetProvider>)
}

beforeEach(() => {
  movilGuardado.valor = { dispositivo: 7, clave: 'clave-del-movil', nombre: 'iPhone de Ana' }
  olvidar.mockReset()
})

afterEach(() => { vi.unstubAllGlobals() })

describe('AprobarEntradaPage', () => {
  it('enseña los tres números y aprueba con el elegido, con la clave del móvil', async () => {
    const fetchMock = mockPorUrl({
      '/auth/aprobacion/abc123': pendiente,
      '/auth/aprobacion/abc123/aprobar': { cuerpo: { estado: 'APROBADA' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    montar()

    expect(await screen.findByRole('heading', { name: 'Alguien entra en el CMS con tu cuenta' })).toBeInTheDocument()
    expect(screen.getByText('Windows · Chrome')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '47' }))

    expect(await screen.findByRole('heading', { name: 'Entrada aprobada' })).toBeInTheDocument()
    const llamada = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/aprobar'))!
    expect(JSON.parse(llamada[1].body as string)).toEqual({ dispositivo: 7, clave: 'clave-del-movil', numero: 47 })
  })

  it('un número equivocado anula la entrada', async () => {
    vi.stubGlobal('fetch', mockPorUrl({
      '/auth/aprobacion/abc123': pendiente,
      '/auth/aprobacion/abc123/aprobar': { cuerpo: { estado: 'FALLADA' } },
    }))
    montar()

    await userEvent.click(await screen.findByRole('button', { name: '18' }))
    expect(await screen.findByRole('heading', { name: 'Número equivocado' })).toBeInTheDocument()
  })

  it('«No he sido yo» la bloquea y ofrece cambiar la contraseña', async () => {
    vi.stubGlobal('fetch', mockPorUrl({
      '/auth/aprobacion/abc123': pendiente,
      '/auth/aprobacion/abc123/rechazar': { cuerpo: { estado: 'RECHAZADA' } },
    }))
    montar()

    await userEvent.click(await screen.findByRole('button', { name: 'No he sido yo' }))
    expect(await screen.findByRole('heading', { name: 'Entrada bloqueada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cambiar la contraseña' })).toHaveAttribute('href', '/reset-password?area=cms')
  })

  it('una entrada que ya no espera lo dice, sin números', async () => {
    vi.stubGlobal('fetch', mockPorUrl({ '/auth/aprobacion/abc123': { cuerpo: { estado: 'CADUCADA' } } }))
    montar()

    expect(await screen.findByRole('heading', { name: 'Esta entrada ya no está esperando' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '47' })).not.toBeInTheDocument()
  })

  it('sin clave guardada, el móvil no está apuntado y no pregunta al servidor', async () => {
    movilGuardado.valor = null
    const fetchMock = mockPorUrl({})
    vi.stubGlobal('fetch', fetchMock)
    montar()

    expect(await screen.findByRole('heading', { name: 'Este móvil no está apuntado' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un móvil que el servidor ya no reconoce olvida su clave', async () => {
    vi.stubGlobal('fetch', mockPorUrl({
      '/auth/aprobacion/abc123': { status: 403, cuerpo: { codigo: 'MOVIL_NO_APUNTADO', message: 'Este móvil ya no está apuntado para aprobar entradas.' } },
    }))
    montar()

    expect(await screen.findByRole('heading', { name: 'Este móvil no está apuntado' })).toBeInTheDocument()
    expect(olvidar).toHaveBeenCalled()
  })
})
