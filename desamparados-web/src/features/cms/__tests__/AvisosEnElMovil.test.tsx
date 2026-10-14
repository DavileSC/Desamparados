import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AvisosEnElMovil from '../AvisosEnElMovil'

const movilGuardado = vi.hoisted(() => ({ valor: null as null | { dispositivo: number; clave: string; nombre: string } }))
const olvidar = vi.hoisted(() => vi.fn())
const tactil = vi.hoisted(() => ({ valor: false }))

vi.mock('../../../lib/movilApuntado', async (original) => ({
  ...(await original<typeof import('../../../lib/movilApuntado')>()),
  leerEsteMovil: async () => movilGuardado.valor,
  olvidarEsteMovil: olvidar,
  darDeBajaEsteNavegador: async () => undefined,
  esPantallaTactil: () => tactil.valor,
}))

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const moviles = [
  { id: 7, nombre: 'iPhone de Ana', creadoEn: '2026-10-14T08:00:00.000Z', usadoEn: '2026-10-14T08:42:00.000Z' },
  { id: 9, nombre: 'Samsung de casa', creadoEn: '2026-10-02T08:00:00.000Z', usadoEn: null },
]

function mockMoviles(lista = moviles, disponible = true) {
  return vi.fn().mockImplementation((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/auth/movil/') && init?.method === 'DELETE') return respuesta(null, 204)
    if (url.includes('/auth/moviles')) return respuesta({ disponible, clavePublica: disponible ? 'BClave' : null, moviles: lista })
    return respuesta({}, 404)
  })
}

beforeEach(() => {
  movilGuardado.valor = null
  tactil.valor = false
  olvidar.mockReset()
})

afterEach(() => { vi.unstubAllGlobals() })

describe('AvisosEnElMovil', () => {
  it('en el ordenador lista los móviles y explica cómo apuntar otro, sin formulario', async () => {
    vi.stubGlobal('fetch', mockMoviles())
    renderWithProviders(<AvisosEnElMovil />)

    expect(await screen.findByText('iPhone de Ana')).toBeInTheDocument()
    expect(screen.getByText('Samsung de casa')).toBeInTheDocument()
    expect(screen.getByText('2 móviles')).toBeInTheDocument()
    expect(screen.getByText(/sin usar todavía/)).toBeInTheDocument()
    expect(await screen.findByText(/entra en «Mi seguridad» desde ese móvil/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/tu contraseña/i)).not.toBeInTheDocument()
  })

  it('«Quitar» pide confirmación y quita el móvil', async () => {
    const fetchMock = mockMoviles()
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<AvisosEnElMovil />)

    await userEvent.click(await screen.findByRole('button', { name: 'Quitar Samsung de casa' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar' }))

    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('/auth/movil/9') && init?.method === 'DELETE')).toBe(true))
    // Era otro móvil: la clave de este no se toca.
    expect(olvidar).not.toHaveBeenCalled()
  })

  it('señala este móvil en la lista y no ofrece apuntarlo otra vez', async () => {
    movilGuardado.valor = { dispositivo: 7, clave: 'clave', nombre: 'iPhone de Ana' }
    tactil.valor = true
    vi.stubGlobal('fetch', mockMoviles())
    renderWithProviders(<AvisosEnElMovil />)

    expect(await screen.findByText('Este móvil')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avisarme en este móvil' })).not.toBeInTheDocument()
  })

  it('una clave guardada de un móvil que ya no está en la lista se olvida', async () => {
    movilGuardado.valor = { dispositivo: 3, clave: 'clave', nombre: 'Viejo' }
    vi.stubGlobal('fetch', mockMoviles())
    renderWithProviders(<AvisosEnElMovil />)

    await waitFor(() => expect(olvidar).toHaveBeenCalled())
  })

  it('sin las claves del servidor, la sección no aparece', async () => {
    const fetchMock = mockMoviles([], false)
    vi.stubGlobal('fetch', fetchMock)
    const { container } = renderWithProviders(<AvisosEnElMovil />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
