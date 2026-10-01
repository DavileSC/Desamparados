import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import BloqueDonativo from '../BloqueDonativo'
import { leerImportes } from '../../../features/cms/bloques/formularios/donativo'
import type { BloqueDonativo as Datos } from '../../../lib/api/contenido'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const BLOQUE: Datos = { tipo: 'donativo', titulo: 'Colabora', texto: 'Lo que das llega a quien lo necesita.', importes: [5, 10, 20], destinos: ['Caridad', 'Cultos'] }
const RUTA = '/nuestros-fines/caridad'

function servidor({ pago = { metodos: ['TARJETA', 'BIZUM'], pruebas: false } as unknown, inicio = { tipo: 'banco', pedido: '00000042AB7Z', url: 'https://sis-t.redsys.es:25443/sis/realizarPago', campos: { Ds_Signature: 'firma' } } as unknown, estado = { estado: 'PAGADO', importe: 20 } } = {}) {
  const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (String(url).includes('/pagos/metodos')) return Promise.resolve(json({ pago }))
    if (String(url).includes('/pagos/donativo/')) return Promise.resolve(json(estado))
    if (String(url).includes('/pagos/donativo')) return Promise.resolve(json(inicio))
    return Promise.resolve(json({}))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('BloqueDonativo', () => {
  it('elige importe y destino y se va al banco con la página desde la que dona', async () => {
    const user = userEvent.setup()
    const enviados: HTMLFormElement[] = []
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) { enviados.push(this) })
    const llamadas = servidor()
    renderWithProviders(<BloqueDonativo bloque={BLOQUE} />, { ruta: RUTA })

    // El segundo importe sale marcado; sin destino todavía, no se puede donar.
    expect(screen.getByRole('button', { name: /^10\s€$/ })).toHaveAttribute('aria-pressed', 'true')
    const tarjeta = await screen.findByRole('button', { name: /Donar 10\s€ con tarjeta/ })
    expect(tarjeta).toBeDisabled()
    expect(screen.getByText(/Elige antes a qué lo destinas/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^20\s€$/ }))
    await user.click(screen.getByRole('button', { name: 'Caridad' }))
    await user.type(screen.getByRole('textbox', { name: /Tu correo/ }), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /Donar 20\s€ con tarjeta/ }))

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ pagina: 'caridad', importe: 20, metodo: 'TARJETA', destino: 'Caridad', email: 'ana@example.com' })
    expect(enviados[0].action).toBe('https://sis-t.redsys.es:25443/sis/realizarPago')
  })

  it('«Otro» admite céntimos y no deja pasar lo que no es un importe', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ inicio: { tipo: 'hecho', total: 7.5, repetida: false } })
    renderWithProviders(<BloqueDonativo bloque={{ ...BLOQUE, destinos: [] }} />, { ruta: RUTA })

    await user.click(screen.getByRole('button', { name: 'Otro' }))
    const campo = screen.getByRole('textbox', { name: 'Importe (€)' })
    await user.type(campo, '0,5')
    expect(screen.getByText(/entre 1 y 5000/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^Donar/ })).toBeDisabled()

    await user.clear(campo)
    await user.type(campo, '7,50')
    await user.click(screen.getByRole('button', { name: /Donar 7,50\s€/ }))
    expect(await screen.findByText(/hemos recibido tu donativo de 7,50\s€/)).toBeInTheDocument()
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ pagina: 'caridad', importe: 7.5, metodo: 'TARJETA' })
  })

  it('con certificado para la renta, pide los datos de Hacienda y el correo, y los manda', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ inicio: { tipo: 'hecho', total: 10, repetida: false } })
    renderWithProviders(<BloqueDonativo bloque={{ ...BLOQUE, destinos: [] }} />, { ruta: RUTA })

    await user.click(screen.getByRole('checkbox', { name: /certificado para desgravarlo/ }))
    const donar = await screen.findByRole('button', { name: /^Donar/ })
    expect(donar).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Ana')
    await user.type(screen.getByRole('textbox', { name: 'Apellidos' }), 'Ruiz Gil')
    await user.type(screen.getByRole('textbox', { name: 'NIF' }), '12345678A')
    expect(screen.getByText(/la letra no cuadra/)).toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'NIF' }))
    await user.type(screen.getByRole('textbox', { name: 'NIF' }), '12345678z')
    await user.type(screen.getByRole('textbox', { name: 'Código postal' }), '29006')
    // Sin correo no hay adonde mandar el certificado.
    expect(donar).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Tu correo' }), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /^Donar/ }))

    expect(await screen.findByText(/hemos recibido tu donativo/)).toBeInTheDocument()
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
      pagina: 'caridad', importe: 10, metodo: 'TARJETA', email: 'ana@example.com',
      fiscal: { nif: '12345678Z', nombre: 'Ana', apellidos: 'Ruiz Gil', codigoPostal: '29006' },
    })
  })

  it('sin pago en línea, lo dice y no ofrece pagar', async () => {
    servidor({ pago: null })
    renderWithProviders(<BloqueDonativo bloque={BLOQUE} />, { ruta: RUTA })
    expect(await screen.findByText(/todavía no están disponibles/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Donar/ })).not.toBeInTheDocument()
  })

  it('a la vuelta del banco da las gracias, y si no se pagó lo dice sin preguntar', async () => {
    servidor()
    const { unmount } = renderWithProviders(<BloqueDonativo bloque={BLOQUE} />, { ruta: `${RUTA}?donativo=00000042AB7Z` })
    expect(await screen.findByText(/¡Gracias! Hemos recibido tu donativo de 20\s€/)).toBeInTheDocument()
    unmount()

    const llamadas = servidor()
    renderWithProviders(<BloqueDonativo bloque={BLOQUE} />, { ruta: `${RUTA}?donativo=00000042AB7Z&resultado=no` })
    expect(await screen.findByText(/no se ha completado y no se te ha cobrado nada/)).toBeInTheDocument()
    expect(llamadas.some((l) => l.url.includes('/pagos/donativo/'))).toBe(false)
  })
})

describe('los importes del CMS', () => {
  it('lee la lista escrita y rechaza lo que el servidor rechazaría', () => {
    expect(leerImportes('5, 10, 20')).toEqual([5, 10, 20])
    expect(leerImportes('5 10;20')).toEqual([5, 10, 20])
    expect(leerImportes('')).toBeNull()
    expect(leerImportes('5, 5')).toBeNull()
    expect(leerImportes('7,5')).toEqual([7, 5])
    expect(leerImportes('0')).toBeNull()
    expect(leerImportes('6000')).toBeNull()
    expect(leerImportes('1, 2, 3, 4, 5, 6, 7')).toBeNull()
  })
})
