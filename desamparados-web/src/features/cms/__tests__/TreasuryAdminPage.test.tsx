import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import TreasuryAdminPage from '../TreasuryAdminPage'

function responder(total: number) {
  // mockImplementation, no mockResolvedValue: esta pantalla llama a fetch más
  // de una vez (carga inicial y al cambiar de año), y compartir una única
  // instancia de Response rompería el segundo `.text()` con la Fetch API real
  // (el cuerpo solo se puede leer una vez).
  return vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data: [], meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
}

const json = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }))

const recibo = (id: number, estado: string, concepto: string) => ({
  id, year: 2026, concepto, importe: '25.00', fechaEmision: '2026-01-10T10:00:00.000Z', estado,
  fechaPago: null, metodoPago: null, hermano: { id: 5, nombre: 'Ana', apellidos: 'Pérez Ruiz', numeroHermano: 12 },
})

/**
 * Un servidor de mentira que responde según la ruta: el listado, el buscador
 * de hermanos, la emisión y el cobro. Cada respuesta es una instancia nueva
 * (el cuerpo de un Response solo se lee una vez).
 */
function servidor(recibos: unknown[] = []) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const ruta = String(url)
    if (ruta.includes('/recibos/admin/hermanos')) return json([{ id: 5, nombre: 'Ana', apellidos: 'Pérez Ruiz', numeroHermano: 12 }])
    if (init?.method === 'POST' && /\/recibos\/admin$/.test(ruta)) return json({ message: 'Recibo «Cuota anual (reemisión)» emitido.', reciboId: 90, estado: 'PENDIENTE' }, 201)
    if (init?.method === 'POST' && ruta.endsWith('/pagar')) return json({ message: 'Recibo cobrado correctamente.', reciboId: 1, estado: 'PAGADO' })
    return json({ data: recibos, meta: { total: recibos.length, page: 1, limit: 20, totalPages: 1 } })
  })
}

const llamadas = (simulado: ReturnType<typeof vi.fn>, filtro: (ruta: string, init?: RequestInit) => boolean) =>
  simulado.mock.calls.filter(([url, init]) => filtro(String(url), init as RequestInit | undefined))

afterEach(() => { vi.unstubAllGlobals() })

describe('TreasuryAdminPage', () => {
  it('dice cuántos recibos hay en total, no cuántos se ven', async () => {
    // 1.167 recibos y una pantalla que enseñaba 200 sin decirlo.
    vi.stubGlobal('fetch', responder(1167))
    renderWithProviders(<TreasuryAdminPage />)
    expect(await screen.findByText(/de 1167/i)).toBeInTheDocument()
  })

  it('al entrar se ven los recibos; generar cuotas va en una ventana con el año que se está viendo', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', responder(3))
    renderWithProviders(<TreasuryAdminPage />)

    expect(await screen.findByText(/3 resultados/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/importe/i)).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText(/año/i))
    await user.type(screen.getByLabelText(/año/i), '2025')
    await user.click(screen.getByRole('button', { name: /generar cuotas/i }))

    const ventana = screen.getByRole('dialog', { name: /generar cuotas/i })
    expect(within(ventana).getByLabelText(/año/i)).toHaveValue(2025)
    expect(within(ventana).getByLabelText(/importe/i)).toBeInTheDocument()
  })

  it('cambiar de año vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const fetchSimulado = responder(1167)
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<TreasuryAdminPage />, { ruta: '/cms/tesoreria?pagina=4' })

    await user.clear(screen.getByLabelText(/año/i))
    await user.type(screen.getByLabelText(/año/i), '2025')

    await waitFor(() => {
      const ultima = String(fetchSimulado.mock.calls.at(-1)?.[0])
      expect(ultima).toContain('page=1')
      expect(ultima).toContain('year=2025')
    })
  })

  it('mientras se teclea el año no pide años a medias, que el servidor rechazaría', async () => {
    const user = userEvent.setup()
    const fetchSimulado = responder(3)
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<TreasuryAdminPage />)
    await screen.findByText(/3 resultados/i)

    await user.clear(screen.getByLabelText(/año/i))
    await user.type(screen.getByLabelText(/año/i), '2025')

    await waitFor(() => expect(String(fetchSimulado.mock.calls.at(-1)?.[0])).toContain('year=2025'))
    const años = fetchSimulado.mock.calls.map(([url]) => new URL(String(url), 'http://x').searchParams.get('year'))
    expect(años.every((a) => a === null || /^\d{4}$/.test(a))).toBe(true)
  })

  // Encadena muchas interacciones reales de userEvent (teclear, abrir dos
  // desplegables, esperar la búsqueda de hermano); con el resto de la suite
  // completa corriendo en paralelo puede rozar el límite por defecto de 5 s
  // sin que haya nada roto, así que lleva su propio margen.
  it('«Nuevo recibo» abre una ventana, busca al hermano y emite el recibo con su importe con coma', async () => {
    const user = userEvent.setup()
    const simulado = servidor()
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TreasuryAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo recibo/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo recibo/i })
    const emitir = within(ventana).getByRole('button', { name: /emitir recibo/i })
    expect(emitir).toBeDisabled()

    await user.type(within(ventana).getByRole('combobox', { name: /hermano/i }), 'pérez')
    await user.click(await screen.findByRole('option', { name: /pérez ruiz, ana · n\.º 12/i }))
    expect(String(llamadas(simulado, (ruta) => ruta.includes('/recibos/admin/hermanos'))[0]?.[0])).toContain('q=p%C3%A9rez')

    await user.type(within(ventana).getByLabelText(/concepto/i), 'Cuota anual (reemisión)')
    await user.type(within(ventana).getByLabelText(/importe/i), '12,50')
    expect(within(ventana).getByLabelText(/año/i)).toHaveValue(new Date().getFullYear())

    // El tipo no viene elegido: con «cuota» por defecto se duplicaban cuotas sin querer.
    expect(emitir).toBeDisabled()
    await user.click(within(ventana).getByRole('combobox', { name: /tipo/i }))
    await user.click(await screen.findByRole('option', { name: /cuota de hermano/i }))
    expect(within(ventana).getByText(/una cuota por hermano y año/i)).toBeInTheDocument()
    await user.click(emitir)

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /nuevo recibo/i })).not.toBeInTheDocument())
    const [, init] = llamadas(simulado, (ruta, i) => i?.method === 'POST' && /\/recibos\/admin$/.test(ruta))[0]
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      hermanoId: 5, year: new Date().getFullYear(), concepto: 'Cuota anual (reemisión)', importe: 12.5, tipo: 'CUOTA_HERMANO',
    })
    expect(await screen.findByText(/emitido\. queda pendiente de cobro/i)).toBeInTheDocument()
  }, 15000)

  it('un importe negativo o con tres decimales no deja emitir y dice por qué', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', servidor())
    renderWithProviders(<TreasuryAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo recibo/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo recibo/i })
    await user.type(within(ventana).getByLabelText(/importe/i), '-3')
    expect(within(ventana).getByText(/mayor que cero/i)).toBeInTheDocument()
    await user.clear(within(ventana).getByLabelText(/importe/i))
    await user.type(within(ventana).getByLabelText(/importe/i), '12,505')
    expect(within(ventana).getByText(/dos decimales como mucho/i)).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: /emitir recibo/i })).toBeDisabled()
  })

  it('ofrece «Cobrar» en los pendientes y en los remesados, y el remesado se cobra por domiciliación', async () => {
    const user = userEvent.setup()
    const simulado = servidor([recibo(1, 'REMESADO', 'Cuota remesada'), recibo(2, 'PAGADO', 'Cuota pagada'), recibo(3, 'PENDIENTE', 'Cuota pendiente')])
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TreasuryAdminPage />)

    expect(await screen.findByRole('button', { name: /cobrar cuota remesada/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cobrar cuota pendiente/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cobrar cuota pagada/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cobrar cuota remesada/i }))
    await waitFor(() => expect(llamadas(simulado, (ruta) => ruta.endsWith('/pagar'))).toHaveLength(1))
    const [url, init] = llamadas(simulado, (ruta) => ruta.endsWith('/pagar'))[0]
    expect(String(url)).toContain('/recibos/admin/1/pagar')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ metodoPago: 'DOMICILIACION' })
  })
})
