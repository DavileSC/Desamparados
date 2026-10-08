import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import InventarioAdminPage from '../InventarioAdminPage'

const enser = {
  id: 4, nombre: 'Ciriales', referencia: 'CIR-01', categoria: 'Cortejo', ubicacion: 'Sacristía',
  cantidadOptimo: 4, cantidadBueno: 2, cantidadReparar: 0, cantidadTotal: 6,
}
const prenda = {
  id: 9, numero: 'TUN-002', tipo: 'TUNICA', talla: '1.80m',
  estado: 'DISPONIBLE', observaciones: null, hermano: null,
}

afterEach(() => { vi.unstubAllGlobals() })

describe('InventarioAdminPage', () => {
  it('cada listado pasa página por su cuenta', async () => {
    // Con un solo parámetro compartido, pasar página en enseres movería el ropero.
    const user = userEvent.setup()
    // Una instancia de Response por llamada: `llamarApi` lee el cuerpo con
    // `res.text()` y la pantalla hace dos peticiones, una por listado.
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [], meta: { total: 120, page: 1, limit: 20, totalPages: 6 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })

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
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })

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
      JSON.stringify(String(url).includes('/recuento') ? recuento() : {
        data: [String(url).includes('/enseres') ? enser : prenda],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))))
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })

    expect(await screen.findByRole('link', { name: /editar ciriales/i })).toHaveAttribute('href', '/cms/inventario/4/editar')

    await user.click(screen.getByRole('tab', { name: 'Ropero' }))

    expect(await screen.findByRole('link', { name: /editar tun-002/i })).toHaveAttribute('href', '/cms/inventario/9/editar?tipo=prenda')
  })

  it('el alta de una prenda no ofrece «Prestada»: eso lo hace «Prestar», que anota a quién', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(respuestaJson({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }))))
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('tab', { name: 'Ropero' }))
    await user.click(screen.getByRole('button', { name: /nueva prenda/i }))
    await user.click(within(screen.getByRole('dialog', { name: /nueva prenda/i })).getByLabelText('Estado'))
    const opciones = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(opciones).toEqual(['Disponible', 'En lavado', 'Para arreglar', 'De baja'])
  })

  it('las cantidades de un enser tienen que ser enteras para poder guardarlo', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(respuestaJson({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }))))
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('button', { name: /nuevo enser/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo enser/i })
    await user.type(within(ventana).getByLabelText('Nombre'), 'Ciriales')
    const optimo = within(ventana).getByLabelText('Óptimo')
    await user.clear(optimo)
    await user.type(optimo, '2.5')

    expect(within(ventana).getByText(/números enteros/i)).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('se presta buscando por nombre y apellidos; con dos que se llaman igual, lo avisa y se elige por la ficha', async () => {
    const user = userEvent.setup()
    const tocayo = (id: number, numeroHermano: number, fechaNacimiento: string) => ({
      id, numeroHermano, nombre: 'Ana', apellidos: 'Ruiz Martín', fechaNacimiento, puesto: null, gestor: null, prendas: [],
    })
    const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const ruta = String(url)
      if (ruta.includes('/recuento')) return Promise.resolve(respuestaJson(recuento()))
      if (ruta.includes('/ropero/hermanos?q=')) return Promise.resolve(respuestaJson([tocayo(76, 123, '1990-05-01'), tocayo(77, 517, '2015-03-02')]))
      if (init?.method === 'POST') return Promise.resolve(respuestaJson({ message: 'Prenda asignada correctamente' }))
      return Promise.resolve(respuestaJson({ data: [ruta.includes('/enseres') ? enser : prenda], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }))
    })
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('tab', { name: 'Ropero' }))
    await user.click(await screen.findByRole('button', { name: 'Prestar TUN-002' }))
    const dialogo = screen.getByRole('dialog', { name: /prestar la prenda tun-002/i })
    expect(within(dialogo).getByRole('button', { name: 'Prestar' })).toBeDisabled()

    await user.type(within(dialogo).getByLabelText('Nombre y apellidos'), 'ana ruiz')
    const opciones = await within(dialogo).findAllByRole('option')
    expect(opciones).toHaveLength(2)
    expect(within(dialogo).getAllByText(/hay otro con el mismo nombre/i)).toHaveLength(2)
    expect(within(opciones[1]).getByText(/n\.º 517/i)).toBeInTheDocument()

    await user.click(opciones[1])
    await user.click(within(dialogo).getByRole('button', { name: 'Prestar a Ana Ruiz Martín' }))
    await waitFor(() => {
      const envio = simulado.mock.calls.find(([url, init]) => String(url).includes('/prendas/9/asignar') && init?.method === 'POST')
      expect(envio).toBeDefined()
      expect(JSON.parse(String(envio![1].body))).toEqual({ hermanoId: 77 })
    })
    expect(await screen.findByText('Prenda TUN-002 prestada a Ana Ruiz Martín.')).toBeInTheDocument()
  })

  it('«Devolver» pregunta con tres salidas y «Cancelar» no devuelve nada; la túnica va siempre al lavado', async () => {
    const user = userEvent.setup()
    const prestada = { ...prenda, estado: 'PRESTADA', hermano: { nombre: 'Ana', apellidos: 'Ruiz', numeroHermano: 123 } }
    const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(respuestaJson({ message: 'Prenda devuelta con éxito', data: { ...prenda, estado: 'TALLER' } }))
      if (String(url).includes('/cingulos')) return Promise.resolve(respuestaJson({ total: 0, prestados: 0, enElRopero: 0, debidos: 0 }))
      if (String(url).includes('/recuento')) return Promise.resolve(respuestaJson(recuento({ PRESTADA: 1 })))
      return Promise.resolve(respuestaJson({ data: [String(url).includes('/enseres') ? enser : prestada], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }))
    })
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })
    const devoluciones = () => simulado.mock.calls.filter(([url, init]) => String(url).includes('/devolver') && init?.method === 'POST')

    await user.click(await screen.findByRole('tab', { name: 'Ropero' }))
    await user.click(await screen.findByRole('button', { name: 'Devolver TUN-002' }))
    const dialogo = screen.getByRole('dialog', { name: /cómo vuelve la prenda tun-002/i })
    expect(within(dialogo).getByText(/la tenía ana ruiz/i)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(devoluciones()).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Devolver TUN-002' }))
    const otra = screen.getByRole('dialog')
    expect(within(otra).getByText(/las túnicas se lavan todas/i)).toBeInTheDocument()
    expect(within(otra).getByRole('button', { name: 'Vuelve bien: al lavado' })).toBeInTheDocument()
    await user.click(within(otra).getByRole('button', { name: 'Está rota: al taller' }))
    await waitFor(() => expect(devoluciones()).toHaveLength(1))
    expect(JSON.parse(String(devoluciones()[0][1]!.body))).toEqual({ rota: true })
    expect(await screen.findByText('Prenda TUN-002 devuelta: al taller, para arreglarla.')).toBeInTheDocument()
  })

  it('una prenda prestada no se puede eliminar, y si el servidor lo rechaza se dice por qué', async () => {
    const user = userEvent.setup()
    const prestada = { ...prenda, id: 10, numero: 'TUN-003', estado: 'PRESTADA', hermano: { nombre: 'Ana', apellidos: 'Ruiz', numeroHermano: 123 } }
    const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      // Una que se prestó en otra mesa mientras tanto: aquí aún se ve disponible.
      if (init?.method === 'DELETE') return Promise.resolve(new Response(JSON.stringify({ error: 'La prenda está prestada y no se puede borrar.' }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
      if (String(url).includes('/cingulos')) return Promise.resolve(respuestaJson({ total: 0, prestados: 0, enElRopero: 0, debidos: 0 }))
      if (String(url).includes('/recuento')) return Promise.resolve(respuestaJson(recuento({ PRESTADA: 1, DISPONIBLE: 1 })))
      return Promise.resolve(respuestaJson({ data: String(url).includes('/enseres') ? [enser] : [prenda, prestada], meta: { total: 2, page: 1, limit: 20, totalPages: 1 } }))
    })
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario' })

    await user.click(await screen.findByRole('tab', { name: 'Ropero' }))
    await user.click((await screen.findAllByRole('button', { name: 'Más acciones de TUN-003' }))[0])
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('{Escape}')

    await user.click(screen.getAllByRole('button', { name: 'Más acciones de TUN-002' })[0])
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('La prenda está prestada y no se puede borrar.')).toBeInTheDocument()
  })

  it('los cíngulos se cuentan: se cambia el total y avisa si no llegan para los que se deben', async () => {
    const user = userEvent.setup()
    const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/cingulos') && init?.method === 'PUT') return Promise.resolve(respuestaJson({ total: 40, prestados: 30, enElRopero: 10, debidos: 3 }))
      if (String(url).includes('/cingulos')) return Promise.resolve(respuestaJson({ total: 31, prestados: 30, enElRopero: 1, debidos: 3 }))
      if (String(url).includes('/prendas/lavadas')) return Promise.resolve(respuestaJson({ ids: [9, 10], lavadas: 2 }))
      // Con algo en el lavado, la cabecera ofrece darlo todo por limpio.
      if (String(url).includes('/recuento')) return Promise.resolve(respuestaJson(recuento({ LAVADO: 2 })))
      return Promise.resolve(respuestaJson({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }))
    })
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario?vista=ropero' })

    const tarjeta = await screen.findByRole('region', { name: 'Cíngulos' })
    expect(await within(tarjeta).findByText(/hay que pedir o hacer 2 más/)).toBeInTheDocument()
    await user.click(within(tarjeta).getByRole('button', { name: 'Cambiar el total' }))
    const total = within(tarjeta).getByRole('textbox', { name: 'Cíngulos del Grupo' })
    await user.clear(total)
    await user.type(total, '20')
    expect(within(tarjeta).getByText('No puede ser menos que los 30 prestados')).toBeInTheDocument()
    await user.clear(total)
    await user.type(total, '40')
    await user.click(within(tarjeta).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(simulado.mock.calls.some(([u, i]) => String(u).includes('/cingulos') && i?.method === 'PUT' && i.body === JSON.stringify({ total: 40 }))).toBe(true))
    expect(await screen.findByText('Cíngulos del Grupo: 40.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Todo el lavado, limpio' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, todo limpio' }))
    expect(await screen.findByText('2 prendas lavadas quedan disponibles.')).toBeInTheDocument()
  })

  it('cada listado filtra por su cuenta, y la pestaña sigue en la URL', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
      JSON.stringify(String(url).includes('/opciones')
        ? { categorias: ['Cortejo'], ubicaciones: ['Sacristía'] }
        : String(url).includes('/recuento')
          ? [...recuento(), { tipo: 'CAPIROTE', total: 3, estados: { DISPONIBLE: 3 } }]
          : { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario?vista=ropero' })
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
    const fetchSimulado = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
      JSON.stringify(String(url).includes('/recuento') ? recuento() : { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<InventarioAdminPage />, { ruta: '/cms/inventario?vista=ropero' })

    await user.type(await screen.findByRole('textbox', { name: /buscar en el ropero/i }), 'pérez')
    await waitFor(() => {
      const prendas = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/prendas'))
      expect(prendas.at(-1)).toContain('q=p%C3%A9rez')
    })
    expect(await screen.findByText(/no hay prendas con esta búsqueda/i)).toBeInTheDocument()
  })

  it('solo con Procesión es «Ropero»: sin pestañas, prendas y cíngulos, y «Nueva prenda»', async () => {
    vi.stubGlobal('fetch', servidor())
    renderWithProviders(<InventarioAdminPage />, { modulos: ['procesion', 'agenda'] })
    expect(await screen.findByRole('heading', { name: 'Ropero' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nueva prenda/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar en el ropero')).toBeInTheDocument()
  })

  it('solo con Inventario no hay ropero', async () => {
    vi.stubGlobal('fetch', servidor())
    renderWithProviders(<InventarioAdminPage />, { modulos: ['inventario'] })
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuevo enser/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar en el ropero')).not.toBeInTheDocument()
  })
})

function servidor() {
  return vi.fn().mockImplementation((url: string) => Promise.resolve(respuestaJson(
    String(url).includes('/opciones')
      ? { categorias: [], ubicaciones: [] }
      : { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
  )))
}

function respuestaJson(cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/** Lo que responde /ropero/recuento: las túnicas, con los estados que se pidan (por defecto, una disponible). */
function recuento(estados: Record<string, number> = { DISPONIBLE: 1 }) {
  return [{ tipo: 'TUNICA', total: Object.values(estados).reduce((a, b) => a + b, 0), estados }]
}
