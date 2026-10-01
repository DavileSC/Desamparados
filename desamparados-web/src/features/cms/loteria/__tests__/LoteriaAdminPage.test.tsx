import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import LoteriaAdminPage from '../LoteriaAdminPage'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

const TALONARIO = { id: 11, numero: 1, desde: 1, hasta: 50, responsable: 'Bar Pepe', telefono: null, entregadoEl: '2026-11-02T10:00:00.000Z', vendidas: null, metodoPago: null, liquidadoEl: null, importe: null }
const SORTEO = {
  id: 4, nombre: 'Lotería de Navidad 2026', fecha: '2026-12-22', numeros: [{ numero: '04512', premio: null }], precioDecimo: 20, decimos: 50,
  precioParticipacion: 5, jugado: 4, porTalonario: 50, leyenda: '', compra: null, maximoDeParticipaciones: 250,
  talonarios: 2, entregados: 1, liquidados: 0, vendidas: 0, recaudado: 0, premioPorParticipacion: 0, premiosVendidos: 0,
  lista: [TALONARIO, { ...TALONARIO, id: 12, numero: 2, desde: 51, hasta: 100, responsable: null, entregadoEl: null }],
}

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    const u = String(url)
    if (u.endsWith('/loteria')) return Promise.resolve(json([SORTEO]))
    if (u.includes('/liquidacion')) return Promise.resolve(json({ ...SORTEO, liquidados: 1, vendidas: 42, recaudado: 210, entregados: 0, lista: [{ ...TALONARIO, vendidas: 42, liquidadoEl: '2026-12-01T10:00:00.000Z', importe: 210, metodoPago: 'BIZUM' }, SORTEO.lista[1]] }))
    if (u.includes('/talonarios')) return Promise.resolve(json({ ...SORTEO, talonarios: 5 }))
    return Promise.resolve(json(SORTEO))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('LoteriaAdminPage', () => {
  it('enseña el sorteo con sus cifras y no deja añadir más talonarios de los que caben', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<LoteriaAdminPage />)

    const sorteo = await screen.findByRole('region', { name: 'Lotería de Navidad 2026' })
    expect(within(sorteo).getByText('04512')).toBeInTheDocument()
    expect(within(sorteo).getByText(/La compra de los décimos \(1\.000,00\s€\) todavía no está apuntada/)).toBeInTheDocument()
    expect(screen.getByText(/Caben 3 más/)).toBeInTheDocument()

    const nuevos = screen.getByRole('textbox', { name: 'Cuántos' })
    await user.type(nuevos, '4')
    expect(screen.getByRole('button', { name: 'Añadir talonarios' })).toBeDisabled()
    await user.clear(nuevos)
    await user.type(nuevos, '3')
    await user.click(screen.getByRole('button', { name: 'Añadir talonarios' }))
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/loteria/4/talonarios'))?.cuerpo).toEqual({ cantidad: 3 }))
  })

  it('liquidar un talonario dice cuánto se cobra y lo manda con cómo se pagó', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<LoteriaAdminPage />)
    const lista = await screen.findByRole('list', { name: 'Lista de talonarios' })
    await user.click(within(lista).getAllByRole('button', { name: 'Liquidar' })[0])

    const dialogo = await screen.findByRole('dialog', { name: 'Liquidar el talonario n.º 1' })
    const vendidas = within(dialogo).getByRole('textbox', { name: 'Vendidas' })
    await user.clear(vendidas)
    await user.type(vendidas, '42')
    expect(within(dialogo).getByText(/210,00\s€\. Vuelven 8 sin vender/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('combobox', { name: 'Cómo lo ha pagado' }))
    await user.click(await screen.findByRole('option', { name: 'Bizum' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Liquidar' }))

    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/talonarios/11/liquidacion'))?.cuerpo).toEqual({ vendidas: 42, metodoPago: 'BIZUM' }))
    expect(await screen.findByText(/Liquidado el .*: 42 vendidas, 210,00\s€ \(Bizum\)/)).toBeInTheDocument()
  })
})
