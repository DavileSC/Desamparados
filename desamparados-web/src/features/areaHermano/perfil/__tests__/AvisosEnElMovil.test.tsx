import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import AvisosEnElMovil, { PreguntaDeAvisos } from '../AvisosEnElMovil'

const tactil = vi.hoisted(() => ({ valor: false }))
const suscribir = vi.hoisted(() => vi.fn())
const darDeBaja = vi.hoisted(() => vi.fn())

vi.mock('../../../../lib/avisosDelNavegador', async (original) => ({
  ...(await original<typeof import('../../../../lib/avisosDelNavegador')>()),
  admiteAvisos: () => true,
  esIphone: () => false,
  esPantallaTactil: () => tactil.valor,
  nombreDelDispositivo: () => 'Android · Chrome',
  suscribirEsteNavegador: suscribir,
  darDeBajaEsteNavegador: darDeBaja,
}))

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

function mockAvisos(moviles: { id: number; nombre: string; creadoEn: string }[] = [], disponible = true) {
  const lista = [...moviles]
  return vi.fn().mockImplementation((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/hermanos/mis-avisos-movil') && init?.method === 'POST') {
      lista.push({ id: 41, nombre: 'Android · Chrome', creadoEn: '2026-10-14T10:00:00.000Z' })
      return respuesta(lista.at(-1), 201)
    }
    if (url.includes('/hermanos/mis-avisos-movil/') && init?.method === 'DELETE') return respuesta(null, 204)
    if (url.includes('/hermanos/mis-avisos-movil')) return respuesta({ disponible, clavePublica: disponible ? 'BClave' : null, moviles: lista })
    return respuesta({}, 404)
  })
}

beforeEach(() => {
  tactil.valor = false
  localStorage.clear()
  suscribir.mockReset().mockResolvedValue({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } }) })
  darDeBaja.mockReset()
})

afterEach(() => { vi.unstubAllGlobals() })

describe('Avisos en el móvil del área', () => {
  it('el interruptor los activa en este móvil, con el nombre puesto solo', async () => {
    const fetchMock = mockAvisos()
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<AvisosEnElMovil />, { modulos: ['avisos-a-los-hermanos', 'procesion', 'comunicados'] })

    const interruptor = await screen.findByRole('switch', { name: 'Avisos en este ordenador' })
    expect(screen.getByText('Desactivados')).toBeInTheDocument()
    await waitFor(() => expect(interruptor).toBeEnabled())
    await userEvent.click(interruptor)

    expect(await screen.findByText('Activados')).toBeInTheDocument()
    expect(suscribir).toHaveBeenCalledWith('BClave', '/area-hermano/')
    const alta = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    expect(JSON.parse(String((alta[1] as RequestInit).body))).toMatchObject({ nombre: 'Android · Chrome' })
  })

  it('apagarlo quita este móvil y da de baja el navegador', async () => {
    localStorage.setItem('avisos-area:este-movil', '7')
    vi.stubGlobal('fetch', mockAvisos([{ id: 7, nombre: 'Android · Chrome', creadoEn: '2026-10-02T08:00:00.000Z' }]))
    renderWithProviders(<AvisosEnElMovil />, { modulos: ['avisos-a-los-hermanos'] })

    await userEvent.click(await screen.findByRole('switch', { checked: true }))
    await waitFor(() => expect(darDeBaja).toHaveBeenCalledWith('/area-hermano/'))
    expect(localStorage.getItem('avisos-area:este-movil')).toBeNull()
  })

  it('sin las claves del servidor, la tarjeta no aparece', async () => {
    const fetchMock = mockAvisos([], false)
    vi.stubGlobal('fetch', fetchMock)
    const { container } = renderWithProviders(<AvisosEnElMovil />, { modulos: ['avisos-a-los-hermanos'] })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('la primera vez en el móvil pregunta, y «Ahora no» no vuelve a preguntar', async () => {
    tactil.valor = true
    vi.stubGlobal('fetch', mockAvisos())
    const { unmount } = renderWithProviders(<PreguntaDeAvisos />, { modulos: ['avisos-a-los-hermanos'] })

    expect(await screen.findByRole('dialog', { name: '¿Te avisamos en este móvil?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    unmount()

    renderWithProviders(<PreguntaDeAvisos />, { modulos: ['avisos-a-los-hermanos'] })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('en el ordenador no pregunta', async () => {
    const fetchMock = mockAvisos()
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<PreguntaDeAvisos />, { modulos: ['avisos-a-los-hermanos'] })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
