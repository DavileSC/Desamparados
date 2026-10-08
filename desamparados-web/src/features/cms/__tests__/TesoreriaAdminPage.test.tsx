import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import TesoreriaAdminPage from '../TesoreriaAdminPage'

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
    if (init?.method === 'PUT') return json({ message: 'Recibo actualizado. La comisión del banco queda apuntada.', papeletaAnulada: false })
    return json({ data: recibos, meta: { total: recibos.length, page: 1, limit: 20, totalPages: 1 } })
  })
}

/** La última petición del listado, no la de los contadores (van a la vez). */
const ultimaAlListado = (simulado: ReturnType<typeof vi.fn>) =>
  String(simulado.mock.calls.map(([url]) => String(url)).filter((url) => !url.includes('/resumen') && !url.includes('/hermanos')).at(-1))

const llamadas = (simulado: ReturnType<typeof vi.fn>, filtro: (ruta: string, init?: RequestInit) => boolean) =>
  simulado.mock.calls.filter(([url, init]) => filtro(String(url), init as RequestInit | undefined))

afterEach(() => { vi.unstubAllGlobals() })

describe('TesoreriaAdminPage', () => {
  it('dice cuántos recibos hay en total, no cuántos se ven', async () => {
    // 1.167 recibos y una pantalla que enseñaba 200 sin decirlo.
    vi.stubGlobal('fetch', responder(1167))
    renderWithProviders(<TesoreriaAdminPage />)
    expect(await screen.findByText(/de 1167/i)).toBeInTheDocument()
  })

  it('al entrar se ven los recibos; generar cuotas va en una ventana con el año que se está viendo', async () => {
    const user = userEvent.setup({ delay: null })
    vi.stubGlobal('fetch', responder(3))
    renderWithProviders(<TesoreriaAdminPage />)

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
    const user = userEvent.setup({ delay: null })
    const fetchSimulado = responder(1167)
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<TesoreriaAdminPage />, { ruta: '/cms/tesoreria?pagina=4' })

    await user.clear(screen.getByLabelText(/año/i))
    await user.type(screen.getByLabelText(/año/i), '2025')

    await waitFor(() => {
      const ultima = ultimaAlListado(fetchSimulado)
      expect(ultima).toContain('page=1')
      expect(ultima).toContain('year=2025')
    })
  })

  it('mientras se teclea el año no pide años a medias, que el servidor rechazaría', async () => {
    const user = userEvent.setup({ delay: null })
    const fetchSimulado = responder(3)
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<TesoreriaAdminPage />)
    await screen.findByText(/3 resultados/i)

    await user.clear(screen.getByLabelText(/año/i))
    await user.type(screen.getByLabelText(/año/i), '2025')

    await waitFor(() => expect(ultimaAlListado(fetchSimulado)).toContain('year=2025'))
    const años = fetchSimulado.mock.calls.map(([url]) => new URL(String(url), 'http://x').searchParams.get('year'))
    expect(años.every((a) => a === null || /^\d{4}$/.test(a))).toBe(true)
  })

  // Encadena muchas interacciones reales de userEvent (teclear, abrir dos
  // desplegables, esperar la búsqueda de hermano); con el resto de la suite
  // completa corriendo en paralelo puede rozar el límite por defecto de 5 s
  // sin que haya nada roto, así que lleva su propio margen.
  it('«Nuevo recibo» abre una ventana, busca al hermano y emite el recibo con su importe con coma', async () => {
    const user = userEvent.setup({ delay: null })
    const simulado = servidor()
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />)

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
    const user = userEvent.setup({ delay: null })
    vi.stubGlobal('fetch', servidor())
    renderWithProviders(<TesoreriaAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo recibo/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo recibo/i })
    await user.type(within(ventana).getByLabelText(/importe/i), '-3')
    expect(within(ventana).getByText(/mayor que cero/i)).toBeInTheDocument()
    await user.clear(within(ventana).getByLabelText(/importe/i))
    await user.type(within(ventana).getByLabelText(/importe/i), '12,505')
    expect(within(ventana).getByText(/dos decimales como mucho/i)).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: /emitir recibo/i })).toBeDisabled()
  })

  it('cada estado tiene su botón: «Cobrar» el pendiente y «Confirmar» el remesado, que va por domiciliación', async () => {
    const user = userEvent.setup({ delay: null })
    const simulado = servidor([recibo(1, 'REMESADO', 'Cuota remesada'), recibo(2, 'PAGADO', 'Cuota pagada'), recibo(3, 'PENDIENTE', 'Cuota pendiente')])
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />)

    expect(await screen.findByRole('button', { name: /confirmar el cobro de cuota remesada/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cobrar cuota pendiente/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cobrar cuota pagada/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /confirmar el cobro de cuota remesada/i }))
    await waitFor(() => expect(llamadas(simulado, (ruta) => ruta.endsWith('/pagar'))).toHaveLength(1))
    const [url, init] = llamadas(simulado, (ruta) => ruta.endsWith('/pagar'))[0]
    expect(String(url)).toContain('/recibos/admin/1/pagar')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ metodoPago: 'DOMICILIACION' })
  })

  it('busca por hermano o concepto y filtra por estado, volviendo a la primera página', async () => {
    const user = userEvent.setup({ delay: null })
    const simulado = servidor()
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />, { ruta: '/cms/tesoreria?pagina=3' })

    await user.type(await screen.findByRole('textbox', { name: /buscar recibos/i }), 'pérez')
    await waitFor(() => expect(ultimaAlListado(simulado)).toContain('q=p%C3%A9rez'))
    expect(ultimaAlListado(simulado)).toContain('page=1')

    // El estado se elige en los contadores, que hacen de filtro.
    await user.click(screen.getByRole('button', { name: /^devueltos/i }))
    await waitFor(() => expect(ultimaAlListado(simulado)).toContain('estado=DEVUELTO'))
    expect(screen.getByRole('button', { name: /^devueltos/i })).toHaveAttribute('aria-pressed', 'true')
    // Los contadores no se filtran a sí mismos: cuentan todos los estados.
    const resumen = simulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/resumen')).at(-1)
    expect(resumen).toContain('q=p%C3%A9rez')
    expect(resumen).not.toContain('estado=')
  })

  it('el orden y el tipo de la URL llegan al servidor', async () => {
    const simulado = servidor()
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />, { ruta: '/cms/tesoreria?orden=importeDesc&tipo=DONATIVO' })
    await waitFor(() => expect(ultimaAlListado(simulado)).toContain('orden=importeDesc'))
    expect(ultimaAlListado(simulado)).toContain('tipo=DONATIVO')
  })

  it('un orden que no existe en la URL no se manda: el servidor respondería 400', async () => {
    const simulado = servidor()
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />, { ruta: '/cms/tesoreria?orden=iban' })
    await waitFor(() => expect(simulado).toHaveBeenCalled())
    expect(simulado.mock.calls.every(([url]) => !String(url).includes('orden=iban'))).toBe(true)
  })

  it('con el año vacío se ven los recibos de todos los años', async () => {
    const user = userEvent.setup({ delay: null })
    const simulado = servidor()
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />)
    await screen.findByText(`Recibos del año ${new Date().getFullYear()}`)

    await user.clear(screen.getByLabelText(/año/i))
    expect(await screen.findByText('Recibos de todos los años')).toBeInTheDocument()
    await waitFor(() => expect(ultimaAlListado(simulado)).not.toContain('year='))
  })

  it('los contadores dicen cuántos hay y cuánto suman; exentos y anulados no suman', async () => {
    const cero = { cuenta: 0, total: 0 }
    const resumen = { estados: { PENDIENTE: { cuenta: 120, total: 4320 }, REMESADO: { cuenta: 40, total: 1440 }, PAGADO: cero, DEVUELTO: { cuenta: 5, total: 180 }, EXENTO: { cuenta: 7, total: 252 }, ANULADO: cero } }
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => String(url).includes('/resumen')
      ? json(resumen)
      : json({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })))
    renderWithProviders(<TesoreriaAdminPage />)

    const pendientes = await screen.findByRole('button', { name: /^pendientes/i })
    await waitFor(() => expect(pendientes).toHaveTextContent('120'))
    expect(pendientes).toHaveTextContent('4.320,00')
    expect(screen.getByRole('button', { name: /^todos/i })).toHaveTextContent('172')
    expect(screen.getByRole('button', { name: /^exentos/i })).toHaveTextContent('no cuentan')
    expect(screen.getByRole('button', { name: /^todos/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('«Reemitir» abre el nuevo recibo con los datos del devuelto; una papeleta devuelta no se reemite aquí', async () => {
    const user = userEvent.setup({ delay: null })
    const devuelto = { ...recibo(7, 'DEVUELTO', 'Cuota anual 2026'), importe: '36.00', tipo: 'CUOTA_HERMANO' }
    const papeleta = { ...recibo(8, 'DEVUELTO', 'Papeleta de sitio 2026'), tipo: 'PAPELETA_SITIO' }
    vi.stubGlobal('fetch', servidor([devuelto, papeleta]))
    renderWithProviders(<TesoreriaAdminPage />)

    await user.click(await screen.findByRole('button', { name: /reemitir cuota anual 2026/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo recibo/i })
    expect(within(ventana).getByLabelText(/concepto/i)).toHaveValue('Cuota anual 2026 (reemisión)')
    expect(within(ventana).getByLabelText(/importe/i)).toHaveValue('36,00')
    expect(within(ventana).getByRole('combobox', { name: /hermano/i })).toHaveValue('Pérez Ruiz, Ana · n.º 12')
    expect(within(ventana).getByRole('button', { name: /emitir recibo/i })).toBeEnabled()

    expect(screen.queryByRole('button', { name: /reemitir papeleta/i })).not.toBeInTheDocument()
    expect(screen.getByText(/se reemite en la mesa de reparto/i)).toBeInTheDocument()
  })

  it('un remesado que el banco devuelve se marca desde su menú, con la comisión y el día del banco', async () => {
    const user = userEvent.setup({ delay: null })
    const simulado = servidor([recibo(7, 'REMESADO', 'Cuota anual')])
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />)

    await user.click(await screen.findByRole('button', { name: 'Más acciones de Cuota anual de Ana Pérez Ruiz' }))
    // Sin cobro no hay nada en Contabilidad que ver.
    expect(screen.queryByRole('menuitem', { name: /ver en contabilidad/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Devuelto por el banco' }))

    const ventana = screen.getByRole('dialog')
    expect(within(ventana).getByText(/no hay cobro que anular/i)).toBeInTheDocument()
    await user.type(within(ventana).getByLabelText(/comisión del banco/i), '3,5x')
    expect(within(ventana).getByRole('button', { name: 'Devuelto por el banco' })).toBeDisabled()
    await user.clear(within(ventana).getByLabelText(/comisión del banco/i))
    await user.type(within(ventana).getByLabelText(/comisión del banco/i), '3,50')
    // El día del extracto, no el del clic: los asientos van a ese día.
    fireEvent.change(within(ventana).getByLabelText(/día de la devolución/i), { target: { value: '2099-01-01' } })
    expect(within(ventana).getByRole('button', { name: 'Devuelto por el banco' })).toBeDisabled()
    fireEvent.change(within(ventana).getByLabelText(/día de la devolución/i), { target: { value: '2025-12-30' } })
    await user.click(within(ventana).getByRole('button', { name: 'Devuelto por el banco' }))

    expect(await screen.findByText(/la comisión del banco queda apuntada/i)).toBeInTheDocument()
    const [url, init] = llamadas(simulado, (_, i) => i?.method === 'PUT').at(-1)!
    expect(String(url)).toContain('/recibos/admin/7')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ estado: 'DEVUELTO', comision: 3.5, fechaDevolucion: '2025-12-30' })
  })

  it('un cobrado se puede reembolsar avisando del gasto, y lleva a sus apuntes de Contabilidad', async () => {
    const user = userEvent.setup({ delay: null })
    vi.stubGlobal('fetch', servidor([{ ...recibo(8, 'PAGADO', 'Donativo'), fechaPago: '2026-02-01T10:00:00.000Z', metodoPago: 'EFECTIVO' }]))
    renderWithProviders(<TesoreriaAdminPage />)

    await user.click(await screen.findByRole('button', { name: 'Más acciones de Donativo de Ana Pérez Ruiz' }))
    expect(screen.getByRole('menuitem', { name: /ver en contabilidad/i })).toHaveAttribute('href', '/cms/contabilidad?recibo=8')
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toContain('Devuelto por el banco')
    await user.click(screen.getByRole('menuitem', { name: 'Reembolsar al hermano' }))
    const ventana = within(screen.getByRole('dialog'))
    expect(ventana.getByText(/se apunta un gasto de 25,00\s€ que anula el cobro/i)).toBeInTheDocument()
    expect(ventana.getByText(/no queda nada por cobrar y no se reemite/i)).toBeInTheDocument()
  })

  it('un pendiente se puede enviar al banco, eximir o anular; uno anulado no ofrece nada', async () => {
    const user = userEvent.setup({ delay: null })
    vi.stubGlobal('fetch', servidor([recibo(9, 'PENDIENTE', 'Cuota anual'), recibo(10, 'ANULADO', 'Cuota vieja')]))
    renderWithProviders(<TesoreriaAdminPage />)

    await user.click(await screen.findByRole('button', { name: 'Más acciones de Cuota anual de Ana Pérez Ruiz' }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Enviar al banco', 'Eximir de pago', 'Anular'])
    expect(screen.queryByRole('button', { name: 'Más acciones de Cuota vieja de Ana Pérez Ruiz' })).not.toBeInTheDocument()
  })

  it('al llegar desde un apunte enseña solo ese recibo, de cualquier año', async () => {
    const user = userEvent.setup({ delay: null })
    const simulado = servidor([recibo(7, 'PAGADO', 'Cuota anual')])
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<TesoreriaAdminPage />, { ruta: '/cms/tesoreria?recibo=7' })

    expect(await screen.findByText(/solo el recibo #7/i)).toBeInTheDocument()
    await waitFor(() => expect(ultimaAlListado(simulado)).toContain('recibo=7'))
    expect(ultimaAlListado(simulado)).not.toContain('year=')

    await user.click(screen.getByRole('button', { name: 'Todos los recibos' }))
    await waitFor(() => expect(ultimaAlListado(simulado)).not.toContain('recibo='))
  })

  it('un devuelto ya reemitido no pide reemitirse otra vez', async () => {
    vi.stubGlobal('fetch', servidor([{ ...recibo(11, 'DEVUELTO', 'Cuota vieja'), tipo: 'CUOTA_HERMANO', reemitido: true }, { ...recibo(12, 'DEVUELTO', 'Cuota nueva'), tipo: 'CUOTA_HERMANO' }]))
    renderWithProviders(<TesoreriaAdminPage />)

    expect(await screen.findByText('Devuelto · ya reemitido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reemitir Cuota vieja de Ana Pérez Ruiz' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reemitir Cuota nueva de Ana Pérez Ruiz' })).toBeInTheDocument()
  })

  it('con Remesas y Modelo 182 apagados, esas pestañas no están', async () => {
    vi.stubGlobal('fetch', responder(0))
    renderWithProviders(<TesoreriaAdminPage />, { modulos: [] })

    await screen.findByRole('tab', { name: 'Recibos' })
    expect(screen.queryByRole('tab', { name: 'Remesas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Modelo 182' })).not.toBeInTheDocument()
  })

  it('con solo Remesas encendido, está esa pestaña y no Modelo 182', async () => {
    vi.stubGlobal('fetch', responder(0))
    renderWithProviders(<TesoreriaAdminPage />, { modulos: ['remesas'] })

    expect(await screen.findByRole('tab', { name: 'Remesas' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Modelo 182' })).not.toBeInTheDocument()
  })
})
