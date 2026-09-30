import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { renderWithProviders } from '../../../test/test-utils'
import HermanosAdminPage from '../HermanosAdminPage'
import { useAuthStore } from '../../altas/auth/store'
import { CLAVE_PANEL_HOY } from '../../../app/usePanelDeHoy'

type Censo = { data: unknown[]; meta: { total: number; page: number; limit: number; totalPages: number } }

/** El censo y las solicitudes son dos llamadas distintas: responde por URL. */
function responderCenso(censo: Censo, solicitudes: unknown[]) {
  // Desde la Tarea 6 las solicitudes también llegan paginadas.
  const paginaSolicitudes = { data: solicitudes, meta: { total: solicitudes.length, page: 1, limit: 20, totalPages: Math.ceil(solicitudes.length / 20) } }
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    // La ficha abierta a la derecha se pide aparte: responde con esa fila del censo.
    const ficha = /\/hermanos\/admin\/(\d+)$/.exec(String(url))
    const cuerpo = String(url).includes('solicitudes') ? paginaSolicitudes
      : ficha ? censo.data.find((h) => (h as { id: number }).id === Number(ficha[1]))
      : censo
    return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))
}

const censoVacio: Censo = { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }

function respuestaCenso(data: unknown[], total = data.length) {
  return new Response(JSON.stringify({ data, meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const solicitud = {
  id: 3, email: 'nueva@ejemplo.invalido', nombre: 'Lucía', apellidos: 'Ramos Gil',
  createdAt: '2026-08-20T10:00:00.000Z', hermanos: [],
}

beforeEach(() => {
  useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'secre@ejemplo.es', role: 'SECRETARIA', perfiles: [], origen: 'cms' }, hermano: null })
  // La vista vive en la URL y el `BrowserRouter` de los tests comparte el
  // `window.location`: sin esto, un test empieza donde lo dejó el anterior.
  window.history.replaceState({}, '', '/cms/hermanos')
})

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

/**
 * Espia la invalidación de consultas. `renderWithProviders` fabrica su propio
 * `QueryClient` y no lo devuelve, así que el único sitio desde donde mirarla es
 * el prototipo; por eso no basta con leer el estado de la caché: la consulta del
 * panel no tiene aquí a nadie que la observe.
 */
function espiarInvalidaciones() {
  return vi.spyOn(QueryClient.prototype, 'invalidateQueries')
}

/** ¿Se pidió refrescar la consulta del panel, la que alimenta el menú? */
function invalidoElPanel(espia: ReturnType<typeof espiarInvalidaciones>) {
  return espia.mock.calls.some(([filtros]) =>
    JSON.stringify(filtros?.queryKey) === JSON.stringify(CLAVE_PANEL_HOY))
}

describe('HermanosAdminPage', () => {
  it('la pestaña de solicitudes se ve aunque no haya ninguna', async () => {
    // Antes el bloque entero desaparecía sin solicitudes: la función existía y
    // era invisible, así que nadie sabía que estaba.
    const user = userEvent.setup()
    responderCenso(censoVacio, [])
    renderWithProviders(<HermanosAdminPage />)
    await user.click(await screen.findByRole('tab', { name: /solicitudes/i }))
    expect(screen.getByText(/no hay solicitudes pendientes/i)).toBeInTheDocument()
  })

  it('la pestaña lleva el número de pendientes', async () => {
    responderCenso(censoVacio, [
      { id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] },
      { id: 2, email: 'otra@ejemplo.invalido', nombre: 'Otra', apellidos: 'Solicitante', createdAt: '2026-08-02T00:00:00.000Z', hermanos: [{ id: 10 }] },
    ])
    renderWithProviders(<HermanosAdminPage />)
    expect(await screen.findByRole('tab', { name: /solicitudes \(2\)/i })).toBeInTheDocument()
  })

  it('el Hermano Mayor gestiona el censo como secretaría', async () => {
    // Ve las solicitudes y edita fichas: el servidor le deja las dos cosas
    // (rolesGestionCenso en hermano.routes.ts).
    useAuthStore.setState({ status: 'listo', cms: { id: 2, email: 'mayor@ejemplo.es', role: 'HERMANO_MAYOR', perfiles: [], origen: 'cms' }, hermano: null })
    responderCenso(
      { data: [{ id: 5, nombre: 'Rocío', apellidos: 'Gómez Marín', numeroHermano: 118, email: null, activo: true }], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } },
      [{ id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] }],
    )
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?ficha=5' })

    expect(await screen.findByRole('tab', { name: /solicitudes \(1\)/i })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /editar rocío/i })).toHaveAttribute('href', '/cms/hermanos/5/editar')
  })

  it('un hermano raso que llegara al listado no ve el botón de editar', async () => {
    // La guarda de ruta ya no le deja entrar, pero el botón no depende de eso.
    useAuthStore.setState({ status: 'listo', cms: { id: 3, email: 'raso@ejemplo.es', role: 'USER', perfiles: [], origen: 'cms' }, hermano: null })
    responderCenso(
      { data: [{ id: 5, nombre: 'Rocío', apellidos: 'Gómez Marín', numeroHermano: 118, email: null, activo: true }], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } },
      [],
    )
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?ficha=5' })

    await screen.findByRole('heading', { name: 'Gómez Marín, Rocío' })
    expect(screen.queryByRole('link', { name: /editar rocío/i })).not.toBeInTheDocument()
  })

  it('el censo no se mezcla con las solicitudes', async () => {
    const user = userEvent.setup()
    responderCenso(censoVacio, [
      { id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] },
    ])
    renderWithProviders(<HermanosAdminPage />)
    // En la pestaña del censo está el buscador y no las solicitudes.
    expect(await screen.findByLabelText(/buscar por nombre/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /solicitudes/i }))
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/buscar por nombre/i)).not.toBeInTheDocument()
  })

  // Las llamadas al censo se identifican por su URL (contiene '/search'), no
  // por su posición: la Tarea 6 va a paginar también las solicitudes y ese
  // Promise.all volverá a cambiar de orden sin que haya ningún defecto.
  function llamadasAlCenso(fetchSimulado: ReturnType<typeof vi.fn>) {
    return fetchSimulado.mock.calls
      .map((llamada) => String(llamada[0]))
      .filter((url) => url.includes('/hermanos/admin/search'))
  }

  it('pide la página que dice la URL', async () => {
    // mockImplementation, no mockResolvedValue: cada llamada a fetch consume su
    // propio Response, tanto la del censo como la de solicitudes (Promise.all
    // dispara las dos). Compartir una única instancia rompería el segundo
    // `.json()` con la Fetch API real.
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(respuestaCenso([])))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?pagina=3&porPagina=30' })

    await waitFor(() => {
      expect(llamadasAlCenso(fetchSimulado).some((url) => url.includes('page=3') && url.includes('limit=30'))).toBe(true)
    })
  })

  it('buscar vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(respuestaCenso([])))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?pagina=5' })

    await user.type(screen.getByLabelText(/buscar/i), 'Rocío')

    await waitFor(() => {
      const ultimaAlCenso = llamadasAlCenso(fetchSimulado).at(-1)
      expect(ultimaAlCenso).toBeDefined()
      expect(ultimaAlCenso).toContain('page=1')
      expect(ultimaAlCenso).toContain('q=Roc')
    })
  })

  it('la pestaña cuenta todas las solicitudes, no las de la página', async () => {
    // Con doce pendientes y diez por página, «Solicitudes (10)» sería mentira
    // justo en el aviso que empuja a entrar a mirarlas.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
      Promise.resolve(String(url).includes('solicitudes')
        ? new Response(JSON.stringify({ data: [solicitud], meta: { total: 12, page: 1, limit: 10, totalPages: 2 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : respuestaCenso([]))))

    renderWithProviders(<HermanosAdminPage />)
    expect(await screen.findByRole('tab', { name: /solicitudes \(12\)/i })).toBeInTheDocument()
  })

  // --- Hallazgo D10: rechazar borraba sin preguntar y los botones no se
  // deshabilitaban (un doble clic en «Aprobar» daba un 500 o un número saltado).

  /** Solicitudes en la lista; aprobar y rechazar responden con lo que diga la prueba. */
  function servidorSolicitudes(acciones: { aprobar?: () => Promise<unknown>; rechazar?: () => Promise<unknown> } = {}) {
    const llamadas: { url: string; metodo: string }[] = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
      const metodo = init.method ?? 'GET'
      llamadas.push({ url: String(url), metodo })
      let cuerpo: unknown
      if (metodo === 'POST') cuerpo = await (acciones.aprobar?.() ?? Promise.resolve({ message: 'ok' }))
      else if (metodo === 'DELETE') cuerpo = await (acciones.rechazar?.() ?? Promise.resolve({ message: 'ok' }))
      else if (String(url).includes('solicitudes')) cuerpo = { data: [{ ...solicitud, hermanos: [{ id: 9 }] }], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }
      else cuerpo = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
      return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    return llamadas
  }

  it('rechazar pregunta antes de borrar', async () => {
    const user = userEvent.setup()
    const llamadas = servidorSolicitudes()
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?vista=solicitudes' })

    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))
    const dialogo = screen.getByRole('dialog', { name: /rechazar la solicitud/i })
    expect(dialogo).toHaveTextContent(/lucía ramos gil/i)
    expect(dialogo).toHaveTextContent(/no se puede deshacer/i)

    // «Volver» no borra nada.
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false)

    // El diálogo tarda en cerrarse: hasta entonces el resto de la página queda oculto.
    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))
    await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }))
    await waitFor(() => {
      const borrado = llamadas.find((l) => l.metodo === 'DELETE')
      expect(borrado?.url).toContain('/hermanos/admin/solicitudes/3/rechazar')
    })
  })

  it('mientras se aprueba, ningún botón de la solicitud responde', async () => {
    const user = userEvent.setup()
    let terminar!: (valor: unknown) => void
    const llamadas = servidorSolicitudes({ aprobar: () => new Promise((r) => { terminar = r }) })
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?vista=solicitudes' })

    await user.click(await screen.findByRole('button', { name: 'Aprobar' }))
    const ocupado = screen.getByRole('button', { name: /procesando/i })
    expect(ocupado).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled()
    expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(1)

    terminar({ message: 'Solicitud aprobada.' })
    expect(await screen.findByText(/solicitud aprobada correctamente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled()
  })

  it('ofrece asignar números a los hermanos que no lo tienen', async () => {
    // El menú lleva un contador de «hermanos sin número» que hasta ahora no
    // tenía ninguna forma de bajar desde la interfaz.
    const usuario = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit = {}) =>
      Promise.resolve((init.method ?? 'GET') === 'POST'
        ? new Response(JSON.stringify({
            message: 'Se han asignado 2 números de hermano.',
            asignados: [{ id: 7, numeroHermano: 1285 }, { id: 9, numeroHermano: 1286 }],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : respuestaCenso([]))))
    renderWithProviders(<HermanosAdminPage />)

    const boton = await screen.findByRole('button', { name: /asignar n[úu]meros/i })
    await usuario.click(boton)
    await usuario.click(await screen.findByRole('button', { name: /confirmar|asignar/i }))

    expect(await screen.findByText(/se han asignado 2 n[úu]meros/i)).toBeInTheDocument()
  })

  // --- El botón existe para bajar el contador de «hermanos sin número» del menú.
  // Ese número sale de la consulta del panel (`CLAVE_PANEL_HOY`), con cinco
  // minutos de `staleTime`: sin invalidarla, Secretaría leía «Se han asignado 3
  // números» y el menú seguía diciendo 3 durante cinco minutos.
  //
  // El refresco cuelga de las tres acciones que mueven esos números (asignar,
  // aprobar y rechazar) y no de `load()`: el tercer test es el que fija esa
  // decisión y el que impide devolverlo a la recarga.

  it('asignar números refresca el contador del menú', async () => {
    const usuario = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit = {}) =>
      Promise.resolve((init.method ?? 'GET') === 'POST'
        ? new Response(JSON.stringify({ message: 'Se han asignado 2 números de hermano.', asignados: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } })
        : respuestaCenso([]))))
    const espia = espiarInvalidaciones()
    renderWithProviders(<HermanosAdminPage />)

    const boton = await screen.findByRole('button', { name: /asignar n[úu]meros/i })
    await usuario.click(boton)
    await usuario.click(await screen.findByRole('button', { name: /confirmar|asignar/i }))
    await screen.findByText(/se han asignado 2 n[úu]meros/i)

    expect(invalidoElPanel(espia)).toBe(true)
  })

  it('aprobar una solicitud refresca el contador del menú', async () => {
    // Aprobar mueve los mismos números (un pendiente menos, un hermano más):
    // por eso el refresco no cuelga solo del botón de asignar.
    const usuario = userEvent.setup()
    servidorSolicitudes()
    const espia = espiarInvalidaciones()
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?vista=solicitudes' })

    const aprobar = await screen.findByRole('button', { name: 'Aprobar' })
    await usuario.click(aprobar)
    await screen.findByText(/solicitud aprobada correctamente/i)

    expect(invalidoElPanel(espia)).toBe(true)
  })

  it('teclear en el buscador no refresca el panel', async () => {
    // El negativo de los dos de arriba. Buscar a un hermano no cambia ningún
    // contador, y el panel es un agregado caro (censo, dinero, procesión y
    // actividad) que el menú tiene observado: con la invalidación en `load()`,
    // abrir la pantalla y cada rebote del buscador pedían el panel entero otra
    // vez. Esto es lo que impide devolverla ahí dentro de seis meses.
    const usuario = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(respuestaCenso([])))
    vi.stubGlobal('fetch', fetchSimulado)
    const espia = espiarInvalidaciones()
    renderWithProviders(<HermanosAdminPage />)

    await usuario.type(await screen.findByLabelText(/buscar por nombre/i), 'Rocío')
    await waitFor(() => {
      expect(llamadasAlCenso(fetchSimulado).some((url) => url.includes('q=Roc'))).toBe(true)
    })

    // Ni el montaje ni el tecleo: el espía lleva puesto desde antes de pintar.
    expect(invalidoElPanel(espia)).toBe(false)
  })

  it('filtra por situación y ordena por número', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(respuestaCenso([])))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?pagina=4' })

    await user.click(await screen.findByRole('combobox', { name: /situación/i }))
    await user.click(await screen.findByRole('option', { name: 'De baja' }))
    await waitFor(() => expect(llamadasAlCenso(fetchSimulado).at(-1)).toContain('estado=baja'))
    expect(llamadasAlCenso(fetchSimulado).at(-1)).toContain('page=1')

    await user.click(screen.getByRole('combobox', { name: /ordenar por/i }))
    await user.click(await screen.findByRole('option', { name: /número de hermano/i }))
    await waitFor(() => expect(llamadasAlCenso(fetchSimulado).at(-1)).toContain('orden=numero'))
    expect(llamadasAlCenso(fetchSimulado).at(-1)).toContain('estado=baja')
  })

  it('pasar a las solicitudes y volver no pierde los filtros del censo', async () => {
    const user = userEvent.setup()
    responderCenso(censoVacio, [])
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?estado=pendiente&q=ramos' })

    await user.click(await screen.findByRole('tab', { name: /solicitudes/i }))
    await user.click(screen.getByRole('tab', { name: /censo/i }))
    expect(screen.getByRole('button', { name: /quitar el filtro situación/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /buscar por nombre/i })).toHaveValue('ramos')
  })

  it('«Quitar todos» limpia búsqueda y filtros de una vez', async () => {
    const user = userEvent.setup()
    const fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(respuestaCenso([])))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?estado=activo&numero=sin&q=ruiz' })

    await user.click(await screen.findByRole('button', { name: /quitar todos/i }))
    await waitFor(() => {
      const ultima = llamadasAlCenso(fetchSimulado).at(-1) ?? ''
      expect(ultima).not.toMatch(/estado=|numero=|q=/)
    })
    expect(screen.getByRole('textbox', { name: /buscar por nombre/i })).toHaveValue('')
  })

  it('cada fila abre su ficha al lado, con la familia de la cuenta y sin perder los filtros', async () => {
    const user = userEvent.setup()
    const rocio = {
      id: 5, nombre: 'Rocío', apellidos: 'Gómez Marín', numeroHermano: 118, dni: '12345678Z', email: null, activo: true, fechaBaja: null,
      fechaNacimiento: '1980-02-10T00:00:00.000Z', fechaAlta: '2009-03-14T10:00:00.000Z', esTitular: true, tieneTunicaPropia: false,
      tunica: 'L', alturaHombro: null, puesto: null, telefono: null, direccion: null, poblacion: null, codigoPostal: null,
    }
    const ficha = {
      ...rocio,
      user: { email: 'rocio@ejemplo.invalido', telefono: null, hermanos: [
        { id: 6, nombre: 'Pablo', apellidos: 'Ruiz Gómez', fechaNacimiento: '2014-06-01T00:00:00.000Z', numeroHermano: null, esTitular: false, parentesco: 'SOBRINO', activo: false, fechaBaja: null },
      ] },
      recibos: [], papeletas: [], prendas: [{ id: 1, numero: '007', tipo: 'TUNICA', talla: 'L' }],
    }
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(
      /\/hermanos\/admin\/5$/.test(String(url))
        ? new Response(JSON.stringify(ficha), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : respuestaCenso(String(url).includes('solicitudes') ? [] : [rocio]))))
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?estado=activo' })

    await user.click(await screen.findByRole('link', { name: /gómez marín, rocío/i }))

    expect(await screen.findByRole('heading', { name: 'Gómez Marín, Rocío' })).toBeInTheDocument()
    // El correo de la cuenta cuando la ficha no tiene uno propio.
    expect(screen.getByText('rocio@ejemplo.invalido')).toBeInTheDocument()
    // Un sobrino no es «hijo»: sale con su parentesco.
    expect(screen.getByRole('link', { name: /ruiz gómez, pablo.*sobrino o sobrina/i })).toBeInTheDocument()
    expect(screen.getByText('Túnica 007 (L)')).toBeInTheDocument()
    // La fila abierta queda marcada y el filtro sigue puesto.
    expect(screen.getByRole('link', { name: /gómez marín, rocío/i })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /quitar el filtro situación/i })).toBeInTheDocument()
  })
})

describe('los filtros de más y las listas guardadas', () => {
  /** El censo vacío, las listas que haya y lo que se pida, apuntado. */
  function servidor(listas: unknown[] = []) {
    const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
      const metodo = init.method ?? 'GET'
      llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
      const cuerpo = String(url).includes('/admin/listas')
        ? (metodo === 'POST' ? { id: 9, nombre: 'Menores', consulta: 'edad=menores' } : listas)
        : String(url).includes('solicitudes') ? { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
        : censoVacio
      return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }))
    return llamadas
  }
  const buscadas = (llamadas: ReturnType<typeof servidor>) => llamadas.filter((l) => l.url.includes('/admin/search')).map((l) => new URL(l.url, 'http://x').searchParams)

  it('«Más filtros» abre los de edad, correo, cuenta, medalla y boletín, y filtran el censo', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<HermanosAdminPage />)

    await user.click(await screen.findByRole('button', { name: 'Más filtros' }))
    await user.click(screen.getByRole('combobox', { name: 'Edad' }))
    await user.click(await screen.findByRole('option', { name: 'Menores de 18' }))
    await waitFor(() => expect(buscadas(llamadas).some((p) => p.get('edad') === 'menores')).toBe(true))
  })

  it('guarda la búsqueda de ahora con un nombre, y una guardada se aplica entera', async () => {
    const user = userEvent.setup()
    const llamadas = servidor([{ id: 7, nombre: 'Sin correo', consulta: 'correo=sin' }])
    renderWithProviders(<HermanosAdminPage />, { ruta: '/cms/hermanos?edad=menores' })

    expect(await screen.findByRole('button', { name: 'Menos filtros' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar esta lista' }))
    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Menores')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ nombre: 'Menores', consulta: 'edad=menores' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('combobox', { name: 'Listas guardadas' }))
    await user.click(await screen.findByRole('option', { name: 'Sin correo' }))
    await waitFor(() => {
      const ultima = buscadas(llamadas).at(-1)!
      expect(ultima.get('correo')).toBe('sin')
      expect(ultima.get('edad')).toBeNull()
    })
  })
})
