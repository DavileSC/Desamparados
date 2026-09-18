import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import InventoryAdminPage from '../InventoryAdminPage'

const enser = {
  id: 4, nombre: 'Ciriales', referencia: 'CIR-01', categoria: 'Cortejo', ubicacion: 'Sacristía',
  cantidadOptimo: 4, cantidadBueno: 2, cantidadReparar: 0, cantidadTotal: 6,
}
const prenda = {
  id: 9, numero: 'TUN-002', tipo: 'TUNICA', talla: '1.80m',
  estado: 'DISPONIBLE', observaciones: null, hermano: null,
}

afterEach(() => { vi.unstubAllGlobals() })

describe('InventoryAdminPage', () => {
  it('cada listado pasa página por su cuenta', async () => {
    // Con un solo parámetro compartido, pasar página en enseres movería el ropero.
    const user = userEvent.setup()
    // Una instancia de Response por llamada: `apiFetch` lee el cuerpo con
    // `res.text()` y la pantalla hace dos peticiones, una por listado.
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [], meta: { total: 120, page: 1, limit: 20, totalPages: 6 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    await user.click((await screen.findAllByRole('button', { name: /ir a la página 2/i }))[0])

    await waitFor(() => {
      const enseres = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/enseres'))
      const prendas = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/prendas'))
      expect(enseres.at(-1)).toContain('page=2')
      expect(prendas.every((url) => !url.includes('page=2'))).toBe(true)
    })
  })

  it('el botón de alta cambia con la pestaña y abre su ventana', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('button', { name: /nuevo enser/i }))
    expect(screen.getByRole('dialog', { name: /nuevo enser/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: 'Ropero' }))
    expect(screen.queryByRole('button', { name: /nuevo enser/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /nueva prenda/i }))
    expect(screen.getByRole('dialog', { name: /nueva prenda/i })).toBeInTheDocument()
  })

  it('pinta los dos listados con lo que llega en data', async () => {
    const user = userEvent.setup()
    // Cada extremo responde lo suyo: la llamada se distingue por su URL, nunca
    // por su posición en mock.calls.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
      JSON.stringify({
        data: [String(url).includes('/enseres') ? enser : prenda],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    expect(await screen.findByRole('link', { name: /editar ciriales/i })).toHaveAttribute('href', '/cms/inventario/4/editar')

    await user.click(screen.getByRole('tab', { name: 'Ropero' }))

    expect(await screen.findByRole('link', { name: /editar tun-002/i })).toHaveAttribute('href', '/cms/inventario/9/editar?tipo=prenda')
  })

  it('el alta de una prenda no ofrece «Prestada»: eso lo hace «Prestar», que anota a quién', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(respuestaJson({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }))))
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('tab', { name: 'Ropero' }))
    await user.click(screen.getByRole('button', { name: /nueva prenda/i }))
    await user.click(within(screen.getByRole('dialog', { name: /nueva prenda/i })).getByLabelText('Estado'))
    const opciones = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(opciones).toEqual(['Disponible', 'En taller', 'De baja'])
  })

  it('las cantidades de un enser tienen que ser enteras para poder guardarlo', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(respuestaJson({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }))))
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('button', { name: /nuevo enser/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo enser/i })
    await user.type(within(ventana).getByLabelText('Nombre'), 'Ciriales')
    const optimo = within(ventana).getByLabelText('Óptimo')
    await user.clear(optimo)
    await user.type(optimo, '2.5')

    expect(within(ventana).getByText(/números enteros/i)).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('se presta buscando por número de hermano y enseñando su nombre antes de confirmar', async () => {
    const user = userEvent.setup()
    const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const ruta = String(url)
      if (ruta.includes('/hermanos/123')) return Promise.resolve(respuestaJson({ numeroHermano: 123, nombre: 'Ana', apellidos: 'Ruiz Martín' }))
      if (init?.method === 'POST') return Promise.resolve(respuestaJson({ message: 'Prenda asignada correctamente' }))
      return Promise.resolve(respuestaJson({ data: [ruta.includes('/enseres') ? enser : prenda], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }))
    })
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('tab', { name: 'Ropero' }))
    await user.click(await screen.findByRole('button', { name: 'Prestar TUN-002' }))
    const dialogo = screen.getByRole('dialog', { name: /prestar la prenda tun-002/i })
    expect(within(dialogo).getByRole('button', { name: 'Prestar' })).toBeDisabled()

    await user.type(within(dialogo).getByLabelText(/número de hermano/i), '123')
    await user.click(within(dialogo).getByRole('button', { name: 'Buscar' }))
    expect(await within(dialogo).findByText('Nº 123 · Ana Ruiz Martín')).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Prestar a Ana' }))
    await waitFor(() => {
      const envio = simulado.mock.calls.find(([url, init]) => String(url).includes('/prendas/9/asignar') && init?.method === 'POST')
      expect(envio).toBeDefined()
      expect(JSON.parse(String(envio![1].body))).toEqual({ numeroHermano: 123 })
    })
    expect(await screen.findByText('Prenda TUN-002 prestada a Ana Ruiz Martín.')).toBeInTheDocument()
  })

  it('«Devolver» pregunta con tres salidas y «Cancelar» no devuelve nada', async () => {
    const user = userEvent.setup()
    const prestada = { ...prenda, estado: 'PRESTADA', hermano: { nombre: 'Ana', apellidos: 'Ruiz', numeroHermano: 123 } }
    const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(respuestaJson({ message: 'Prenda devuelta con éxito' }))
      return Promise.resolve(respuestaJson({ data: [String(url).includes('/enseres') ? enser : prestada], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }))
    })
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })
    const devoluciones = () => simulado.mock.calls.filter(([url, init]) => String(url).includes('/devolver') && init?.method === 'POST')

    await user.click(await screen.findByRole('tab', { name: 'Ropero' }))
    await user.click(await screen.findByRole('button', { name: 'Devolver TUN-002' }))
    const dialogo = screen.getByRole('dialog', { name: /cómo vuelve la prenda tun-002/i })
    expect(within(dialogo).getByText(/la tenía ana ruiz/i)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(devoluciones()).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Devolver TUN-002' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /con lavado/i }))
    await waitFor(() => expect(devoluciones()).toHaveLength(1))
    expect(JSON.parse(String(devoluciones()[0][1]!.body))).toEqual({ necesitaLavado: true })
  })

  it('cada listado filtra por su cuenta, y la pestaña sigue en la URL', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
      JSON.stringify(String(url).includes('/opciones')
        ? { categorias: ['Cortejo'], ubicaciones: ['Sacristía'] }
        : { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario?vista=ropero' })
    const ultima = (trozo: string) => fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(trozo) && !url.includes('/opciones')).at(-1) ?? ''

    // Entra directamente al ropero.
    expect(await screen.findByRole('tab', { name: 'Ropero', selected: true })).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: /^tipo$/i }))
    await user.click(await screen.findByRole('option', { name: 'Capirote' }))
    await waitFor(() => expect(ultima('/prendas')).toContain('tipo=CAPIROTE'))
    expect(ultima('/enseres')).not.toContain('tipo=')

    await user.click(screen.getByRole('tab', { name: 'Enseres' }))
    await user.click(screen.getByRole('combobox', { name: /ubicación/i }))
    await user.click(await screen.findByRole('option', { name: 'Sacristía' }))
    await waitFor(() => expect(ultima('/enseres')).toContain(`ubicacion=${encodeURIComponent('Sacristía')}`))
    // El filtro del ropero sigue puesto aunque no se vea.
    expect(ultima('/prendas')).toContain('tipo=CAPIROTE')
  })

  it('busca en el ropero por el hermano que tiene la prenda', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario?vista=ropero' })

    await user.type(await screen.findByRole('textbox', { name: /buscar en el ropero/i }), 'pérez')
    await waitFor(() => {
      const prendas = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/prendas'))
      expect(prendas.at(-1)).toContain('q=p%C3%A9rez')
    })
    expect(await screen.findByText(/no hay prendas con esta búsqueda/i)).toBeInTheDocument()
  })
})

function respuestaJson(cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
