import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import { crearQueryClientDePruebas } from '../../../test/queryClient'
import HermanoEditPage from '../HermanoEditPage'

const ficha = {
  id: 42, nombre: 'Rocío', apellidos: 'Gómez Marín', dni: '20000001R',
  fechaNacimiento: '1985-04-12T00:00:00.000Z', email: 'demo.1@ejemplo.invalido', telefono: '600111222',
  direccion: 'Calle Victoria, 14', poblacion: 'Málaga', codigoPostal: '29012',
  activo: true, numeroHermano: 118, fechaAlta: '2019-02-10T00:00:00.000Z', fechaBaja: null,
  esTitular: true, tieneTunicaPropia: false, tunica: 'M', alturaHombro: 168, puesto: 'Nazareno de cirio',
}

const dependiente = { ...ficha, id: 43, nombre: 'Pablo', apellidos: 'Ruiz Serrano', esTitular: false, fechaNacimiento: '2006-05-15T00:00:00.000Z', user: { email: 'padre@ejemplo.invalido', telefono: '600999888' } }

function responder(cuerpo: unknown, status = 200) {
  // Una `Response` nueva por llamada: su cuerpo solo se puede leer una vez, y
  // la pantalla hace dos peticiones (cargar la ficha y guardarla).
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  )))
}

type Llamada = { url: string; metodo: string; cuerpo: unknown }

/**
 * Un servidor de mentira que responde según método y URL, y apunta cada
 * llamada. Para las pantallas que hacen varias peticiones seguidas (cargar,
 * dar de baja, recargar la ficha).
 */
function servidor(manejar: (url: string, metodo: string) => unknown) {
  const llamadas: Llamada[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(init.body as string) : undefined })
    const cuerpo = await manejar(String(url), metodo)
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
  return llamadas
}

/** Una promesa que se resuelve cuando la prueba quiera: para ver la pantalla «trabajando». */
function diferida<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((r) => { resolver = r })
  return { promesa, resolver }
}

const deBaja = { ...ficha, activo: false, numeroHermano: null, fechaBaja: '2024-05-10T00:00:00.000Z' }
const pendiente = { ...ficha, activo: false, numeroHermano: null, fechaBaja: null }

// `HermanoEditPage` pregunta a `useModulos()` (un `useQuery`): necesita un
// QueryClient aunque la mayoría de pruebas no toquen módulos. No se usa
// `renderWithProviders` porque esta pantalla necesita un `RouterProvider`
// con la ruta `:id` para que `useParams()` la lea.
function montar(id = 42, modulos?: readonly string[]) {
  const queryClient = crearQueryClientDePruebas(modulos)
  const router = createMemoryRouter(
    [
      { path: '/cms/hermanos', element: <h1>Gestión de hermanos</h1> },
      { path: '/cms/hermanos/:id/editar', element: <HermanoEditPage /> },
    ],
    { initialEntries: [`/cms/hermanos/${id}/editar`] },
  )
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

afterEach(() => { vi.unstubAllGlobals() })

describe('HermanoEditPage', () => {
  it('enseña los datos personales, el contacto, la hermandad y la procesión', async () => {
    responder(ficha)
    montar()
    expect(await screen.findByDisplayValue('Rocío')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20000001R')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1985-04-12')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Calle Victoria, 14')).toBeInTheDocument()
    expect(screen.getByDisplayValue('29012')).toBeInTheDocument()
    expect(screen.getByDisplayValue('118')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nazareno de cirio')).toBeInTheDocument()
    expect(screen.getByDisplayValue('168')).toBeInTheDocument()
  })

  it('con Procesión apagado no hay esa sección', async () => {
    responder(ficha)
    montar(42, [])
    await screen.findByDisplayValue('Rocío')
    expect(screen.queryByRole('heading', { name: 'Procesión' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Talla de túnica')).not.toBeInTheDocument()
  })

  it('con todos los módulos, la sección de Procesión está', async () => {
    responder(ficha)
    montar()
    await screen.findByDisplayValue('Rocío')
    expect(screen.getByRole('heading', { name: 'Procesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Talla de túnica')).toBeInTheDocument()
  })

  it('no enseña el listado del censo mientras se edita', async () => {
    responder(ficha)
    montar()
    await screen.findByDisplayValue('Rocío')
    expect(screen.queryByRole('heading', { name: /gestión de hermanos/i })).not.toBeInTheDocument()
  })

  it('manda solo la ficha, y las fechas solo si se han tocado', async () => {
    const user = userEvent.setup()
    responder(ficha)
    montar()
    const dni = await screen.findByLabelText('DNI')
    await user.clear(dni)
    await user.type(dni, '20000001X')

    const enviar = vi.fn().mockResolvedValue(new Response(JSON.stringify(ficha), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', enviar)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const [, opciones] = await vi.waitFor(() => {
      expect(enviar).toHaveBeenCalled()
      return enviar.mock.calls[0]
    })
    const cuerpo = JSON.parse(opciones.body as string)
    expect(cuerpo.dni).toBe('20000001X')
    // Los apellidos van por separado: los dos juntos los compone el servidor.
    expect(cuerpo).toMatchObject({ primerApellido: 'Gómez Marín' })
    expect(cuerpo).not.toHaveProperty('apellidos')
    // Sin tocarlas, las fechas no viajan: reenviarlas las reescribía en el servidor.
    expect(cuerpo).not.toHaveProperty('fechaNacimiento')
    expect(cuerpo).not.toHaveProperty('fechaAlta')
    // Sin datos bancarios: no son de esta pantalla.
    expect(cuerpo).not.toHaveProperty('iban')
    // Ni altas ni bajas: la ficha ya no manda `activo` ni toca la baja.
    expect(cuerpo).not.toHaveProperty('activo')
    expect(cuerpo).not.toHaveProperty('fechaBaja')
  })

  it('una fecha que se cambia sí se manda, en formato de día', async () => {
    const user = userEvent.setup()
    const llamadas = servidor(() => ficha)
    montar()
    fireEvent.change(await screen.findByLabelText('Fecha de alta'), { target: { value: '2019-02-11' } })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const guardado = await vi.waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT')
      expect(put).toBeDefined()
      return put!
    })
    expect(guardado.cuerpo).toMatchObject({ fechaAlta: '2019-02-11' })
    expect(guardado.cuerpo).not.toHaveProperty('fechaNacimiento')
  })

  it('la medalla y el tratamiento los pone Secretaría y viajan al guardar', async () => {
    const user = userEvent.setup()
    const llamadas = servidor(() => ficha)
    montar()
    fireEvent.change(await screen.findByLabelText('Imposición de la medalla'), { target: { value: '2020-12-08' } })
    await user.type(screen.getByRole('textbox', { name: 'Tratamiento' }), 'Rvdo. P.')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const guardado = await vi.waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT')
      expect(put).toBeDefined()
      return put!
    })
    expect(guardado.cuerpo).toMatchObject({ fechaMedalla: '2020-12-08', tratamiento: 'Rvdo. P.' })
  })

  it('enseña el alta en el día de Madrid, no en el de UTC', async () => {
    // Aprobada a las 00:30 del 1 de septiembre en Málaga: 22:30 UTC del 31 de agosto.
    responder({ ...ficha, fechaAlta: '2026-08-31T22:30:00.000Z' })
    montar()
    expect(await screen.findByLabelText('Fecha de alta')).toHaveValue('2026-09-01')
    expect(screen.getByText(/en el censo desde el 01\/09\/2026/i)).toBeInTheDocument()
  })

  it('no tiene el interruptor «Hermano activo»', async () => {
    // Era la puerta de atrás: activaba solicitudes sin aprobarlas y, apagado
    // sin fecha, no hacía nada.
    responder(ficha)
    montar()
    await screen.findByDisplayValue('Rocío')
    expect(screen.queryByRole('checkbox', { name: /hermano activo/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Fecha de baja')).not.toBeInTheDocument()
  })

  it('en una ficha activa, «Dar de baja» pide la fecha y el motivo, confirma y no deja pulsar dos veces', async () => {
    const user = userEvent.setup()
    const respuestaBaja = diferida<unknown>()
    let fichaActual: unknown = ficha
    const llamadas = servidor((_url, metodo) => {
      if (metodo === 'DELETE') return respuestaBaja.promesa
      return fichaActual
    })
    montar()
    await user.click(await screen.findByRole('button', { name: 'Dar de baja' }))

    const dialogo = screen.getByRole('dialog', { name: /dar de baja a rocío/i })
    fireEvent.change(within(dialogo).getByLabelText('Fecha de baja'), { target: { value: '2026-01-20' } })
    // Sin motivo no se puede dar la baja.
    expect(within(dialogo).getByRole('button', { name: 'Dar de baja' })).toBeDisabled()
    await user.click(within(dialogo).getByRole('combobox', { name: 'Motivo' }))
    await user.click(await screen.findByRole('option', { name: 'Impago de cuotas' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja' }))

    // Mientras el servidor no contesta, el botón no responde.
    expect(within(dialogo).getByRole('button', { name: /dando de baja/i })).toBeDisabled()

    fichaActual = deBaja
    respuestaBaja.resolver({ message: 'Rocío Gómez Marín dado de baja. El usuario mantiene el acceso.' })
    expect(await screen.findByText(/dado de baja. el usuario mantiene/i)).toBeInTheDocument()

    const bajas = llamadas.filter((l) => l.metodo === 'DELETE')
    expect(bajas).toHaveLength(1)
    expect(bajas[0].url).toContain('/hermanos/admin/42/baja')
    expect(bajas[0].cuerpo).toEqual({ fechaBaja: '2026-01-20', motivo: 'IMPAGO' })
    // La ficha recargada ya está de baja: ahora se ofrece reactivar.
    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument()
  })

  it('en una ficha de baja, «Reactivar» pregunta antes', async () => {
    const user = userEvent.setup()
    const llamadas = servidor((_url, metodo) => (metodo === 'POST' ? { message: 'Hermano reactivado correctamente. Se le ha asignado el nuevo número 301.' } : deBaja))
    montar()
    await user.click(await screen.findByRole('button', { name: 'Reactivar' }))
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false)

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivar' }))
    expect(await screen.findByText(/nuevo número 301/i)).toBeInTheDocument()
    const [reactivacion] = llamadas.filter((l) => l.metodo === 'POST')
    expect(reactivacion.url).toContain('/hermanos/admin/42/reactivar')
  })

  it('en una ficha de baja se corrige la fecha de baja al guardar', async () => {
    const user = userEvent.setup()
    const llamadas = servidor(() => deBaja)
    montar()
    const fechaBaja = await screen.findByLabelText('Fecha de baja')
    expect(fechaBaja).toHaveValue('2024-05-10')
    expect(screen.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument()
    fireEvent.change(fechaBaja, { target: { value: '2024-05-01' } })

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const guardado = await vi.waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT')
      expect(put).toBeDefined()
      return put!
    })
    expect(guardado.cuerpo).toMatchObject({ fechaBaja: '2024-05-01' })
    // Sin número: a una ficha de baja se lo da «Reactivar».
    expect(guardado.cuerpo).not.toHaveProperty('numeroHermano')
  })

  it('una solicitud pendiente no se da de alta ni de baja desde aquí: remite a Solicitudes', async () => {
    servidor(() => pendiente)
    montar()
    expect(await screen.findByText(/solicitud de alta pendiente/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ir a solicitudes/i })).toHaveAttribute('href', '/cms/hermanos?vista=solicitudes')
    expect(screen.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivar' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Número de hermano')).toBeDisabled()
  })

  it('en un dependiente enseña de quién depende y ofrece emanciparlo', async () => {
    responder(dependiente)
    montar(43)
    expect(await screen.findByText(/depende de la cuenta/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /emancipar/i })).toBeInTheDocument()
  })

  it('avisa de que ya tiene edad para tener cuenta propia', async () => {
    responder(dependiente)
    montar(43)
    expect(await screen.findByText(/ya ha cumplido 18/i)).toBeInTheDocument()
  })

  it('a un menor no se le deja emancipar', async () => {
    // El servidor lo rechaza igualmente; aquí se explica antes de intentarlo.
    const hace15 = new Date()
    hace15.setFullYear(hace15.getFullYear() - 15)
    responder({ ...dependiente, fechaNacimiento: hace15.toISOString() })
    montar(43)
    expect(await screen.findByText(/cuando cumpla 18 años/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /emancipar/i })).toBeDisabled()
  })

  it('el botón del diálogo de emancipar no responde mientras trabaja', async () => {
    const user = userEvent.setup()
    const respuesta = diferida<unknown>()
    const llamadas = servidor((_url, metodo) => (metodo === 'POST' ? respuesta.promesa : dependiente))
    montar(43)
    await user.click(await screen.findByRole('button', { name: /emancipar/i }))
    await user.type(screen.getByLabelText(/correo del hermano/i), 'pablo@ejemplo.invalido')
    await user.click(screen.getByRole('button', { name: 'Emancipar hermano' }))

    const ocupado = screen.getByRole('button', { name: /creando la cuenta/i })
    expect(ocupado).toBeDisabled()
    expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(1)
    respuesta.resolver({ id: 99, email: 'pablo@ejemplo.invalido', nombre: 'Pablo' })
    expect(await screen.findByText(/se ha creado la cuenta/i)).toBeInTheDocument()
  })

  it('en un titular no ofrece emancipar: ya tiene su cuenta', async () => {
    responder(ficha)
    montar(42)
    await screen.findByDisplayValue('Rocío')
    expect(screen.queryByRole('button', { name: /emancipar/i })).not.toBeInTheDocument()
  })

  it('emancipar pide el correo y confirma antes de crear la cuenta', async () => {
    const user = userEvent.setup()
    responder(dependiente)
    montar(43)
    await user.click(await screen.findByRole('button', { name: /emancipar/i }))
    await user.type(screen.getByLabelText(/correo del hermano/i), 'pablo@ejemplo.invalido')

    const enviar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 99, email: 'pablo@ejemplo.invalido', nombre: 'Pablo' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', enviar)
    await user.click(screen.getByRole('button', { name: 'Emancipar hermano' }))

    const [url, opciones] = await vi.waitFor(() => {
      expect(enviar).toHaveBeenCalled()
      return enviar.mock.calls[0]
    })
    expect(url).toContain('/hermanos/admin/43/emancipar')
    expect(JSON.parse(opciones.body as string)).toEqual({ newEmail: 'pablo@ejemplo.invalido' })
    // Nadie ha escrito una contraseña en ningún sitio: eso es lo que se buscaba.
    expect(opciones.body as string).not.toMatch(/password/i)
  })

  it('al guardar vuelve al listado sin preguntar por los cambios', async () => {
    // Los cambios se acaban de guardar: preguntar si se van a perder, justo
    // después de guardarlos, es el aviso más confuso posible.
    const user = userEvent.setup()
    responder(ficha)
    montar()
    const dni = await screen.findByLabelText('DNI')
    await user.clear(dni)
    await user.type(dni, '20000001X')

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('heading', { name: /gestión de hermanos/i })).toBeInTheDocument()
    expect(screen.queryByText(/se van a perder/i)).not.toBeInTheDocument()
  })

  it('explica el fallo si la ficha no carga', async () => {
    responder({ message: 'Hermano no encontrado' }, 404)
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })
})
