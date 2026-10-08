import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import Remesas from '../Remesas'
import { deLaCorporacion } from '../../../../domain/articulos'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const REMESA = {
  id: 5, mensajeId: 'REMESA-000005-20261005', fechaCobro: '2026-10-05', numRecibos: 2, total: 60, estado: 'ENVIADA',
  cobradaEl: null, autorNombre: 'Ana Tesorera', createdAt: '2026-09-30T10:00:00.000Z', enElBanco: 2,
}
const ESTADO = { configurada: true, problemas: [], fechaCobroMinima: '2026-10-02', remesas: [REMESA] }
const PREVIA = {
  fechaCobro: '2026-10-02', numRecibos: 3, total: 90,
  excluidos: [{ reciboId: 9, concepto: 'Cuota 2026', importe: 30, hermano: { id: 1, nombre: 'Luis', apellidos: 'Pérez Gil', numeroHermano: 12 }, motivo: 'SIN_IBAN', texto: 'No tiene cuenta en la ficha' }],
}

/** La API de remesas simulada: responde por ruta y método, y apunta lo que se le pide. */
function api(estado: unknown = ESTADO) {
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
    if (ruta.endsWith('/remesas/previa')) return Promise.resolve(json(PREVIA))
    if (ruta.endsWith('/remesas') && init.method === 'POST') return Promise.resolve(json({ ...REMESA, id: 6, mensajeId: 'REMESA-000006-20261002', fechaCobro: '2026-10-02', numRecibos: 3, total: 90 }, 201))
    if (ruta.includes('/fichero')) return Promise.resolve(new Response('<?xml version="1.0"?>', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="remesa-000006-20261002.xml"' } }))
    if (ruta.endsWith('/cobrar')) return Promise.resolve(json({ message: 'Se han cobrado 2 recibos.', cobrados: 2, devueltos: 0 }))
    return Promise.resolve(json(estado))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const llamadas = (fetch: ReturnType<typeof api>, trozo: string, metodo = 'GET') =>
  fetch.mock.calls.filter(([url, init]) => String(url).includes(trozo) && ((init as RequestInit | undefined)?.method ?? 'GET') === metodo)

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:remesa'), revokeObjectURL: vi.fn() }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('Remesas', () => {
  it('sin los datos del acreedor dice qué falta y no deja crear remesas', async () => {
    api({ ...ESTADO, configurada: false, problemas: ['Falta SEPA_ACREEDOR_ID en la configuración del servidor.'], remesas: [] })
    renderWithProviders(<Remesas />)
    expect(await screen.findByText(`Faltan los datos ${deLaCorporacion({ corto: true })} como acreedor`)).toBeInTheDocument()
    expect(screen.getByText('Falta SEPA_ACREEDOR_ID en la configuración del servidor.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva remesa' })).toBeDisabled()
    expect(screen.getByText('Todavía no hay remesas.')).toBeInTheDocument()
  })

  it('enseña las remesas y da una por cobrada tras confirmar', async () => {
    const user = userEvent.setup()
    const fetch = api()
    renderWithProviders(<Remesas />)

    expect(await screen.findByText('Al cobro el 5 oct 2026')).toBeInTheDocument()
    expect(screen.getByText(/REMESA-000005-20261005 · Ana Tesorera/)).toBeInTheDocument()
    expect(screen.getByText('En el banco')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dar por cobrada' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/Los 2 recibos que siguen en el banco pasan a pagados/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Dar por cobrada' }))

    expect(await screen.findByText('Se han cobrado 2 recibos.')).toBeInTheDocument()
    expect(llamadas(fetch, '/remesas/5/cobrar', 'POST')).toHaveLength(1)
  })

  it('una remesa nueva enseña qué entra y qué no, y al generarla descarga el fichero', async () => {
    const user = userEvent.setup()
    const fetch = api()
    renderWithProviders(<Remesas />)

    await user.click(await screen.findByRole('button', { name: 'Nueva remesa' }))
    const ventana = await screen.findByRole('dialog')
    expect(await within(ventana).findByText(/3 recibos por 90,00/)).toBeInTheDocument()
    expect(within(ventana).getByText(/Pérez Gil, Luis \(n\.º 12\) · 30,00 € · No tiene cuenta en la ficha/)).toBeInTheDocument()

    // La primera vista previa: la fecha mínima, las cuotas del año en curso.
    const [, init] = llamadas(fetch, '/remesas/previa', 'POST')[0]
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ fechaCobro: '2026-10-02', year: new Date().getFullYear(), tipo: 'CUOTA_HERMANO' })

    await user.click(within(ventana).getByRole('button', { name: 'Generar y descargar' }))
    expect(await screen.findByText(/Remesa generada: 3 recibos por 90,00 €, al cobro el 2 oct 2026/)).toBeInTheDocument()
    await waitFor(() => expect(llamadas(fetch, '/remesas/6/fichero')).toHaveLength(1))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })
})
