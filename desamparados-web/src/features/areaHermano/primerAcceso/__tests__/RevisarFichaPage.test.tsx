import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import RevisarFichaPage from '../RevisarFichaPage'

function ficha(id: number, nombre: string, extra: Record<string, unknown> = {}) {
  return {
    esTitular: true, parentesco: null,
    id, nombre,
    apellidos: 'Pérez Ruiz', primerApellido: 'Pérez', segundoApellido: 'Ruiz',
    dni: '12345678Z', email: 'ana@ejemplo.test', email2: null,
    telefono: '600000000', telefonoFijo: null,
    direccion: 'Calle Mayor 1', poblacion: 'Málaga', codigoPostal: '29001', provincia: 'Málaga', pais: 'España',
    fechaAlta: '2001-03-01T00:00:00.000Z', fechaNacimiento: '1980-05-10T00:00:00.000Z',
    numeroHermano: 42, activo: true,
    sexo: 'MUJER', estadoCivil: 'CASADO', profesion: null, lugarNacimiento: null,
    fechaBautismo: '1980-06-01T00:00:00.000Z', lugarBautismo: null, parroquiaBautismo: null, fechaJura: null,
    presentadoPor: null, presentadoPor2: null,
    tieneTunicaPropia: false, tunica: null, alturaHombro: null, puesto: null, boletin: true, autorizaImagen: false,
    formaPagoPref: 'DOMICILIACION', ibanEnmascarado: 'ES•• •••• •••• •••• •••• 1332', titularCuenta: null, titularidadCuenta: 'PROPIA',
    ...extra,
  }
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const hijo = (id: number, nombre: string, extra: Record<string, unknown> = {}) =>
  ficha(id, nombre, { esTitular: false, dni: null, numeroHermano: 300 + id, fechaNacimiento: '2014-02-01T00:00:00.000Z', ...extra })

/** La familia de Ana: ella y su hijo Bruno, que el censo colgó de su cuenta sin decir qué es para ella. */
function responder(fichas = [ficha(1, 'Ana'), hijo(2, 'Bruno')]) {
  const simulado = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
    if (init.method === 'PUT') {
      const id = Number(ruta.split('/').pop())
      const cambios = JSON.parse(String(init.body)) as Record<string, unknown>
      return Promise.resolve(json({ message: 'ok', data: { ...fichas.find((f) => f.id === id), ...cambios } }))
    }
    if (ruta.includes('/primer-acceso/confirmar')) return Promise.resolve(json({ confirmada: true }))
    if (ruta.includes('/ajena')) return Promise.resolve(json({ devuelta: true }))
    return Promise.resolve(json({ data: fichas, meta: { total: fichas.length, page: 1, limit: 50, totalPages: 1 } }))
  })
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const llamadasA = (simulado: ReturnType<typeof responder>, trozo: string) =>
  simulado.mock.calls.filter(([url]) => String(url).includes(trozo))
const cuerposPut = (simulado: ReturnType<typeof responder>) =>
  simulado.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT').map(([url, init]) => [String(url).split('/').pop(), JSON.parse(String((init as RequestInit).body))])

/** Tus datos y la cuota, con «Sí, es correcto». */
async function pasarFichaPropia(usuario: ReturnType<typeof userEvent.setup>) {
  for (const titulo of ['Tus datos', 'Cuota y pago']) {
    await screen.findByRole('heading', { level: 1, name: titulo })
    await usuario.click(screen.getByRole('button', { name: 'Sí, es correcto' }))
  }
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

describe('RevisarFichaPage', () => {
  it('pide lo obligatorio que falta, el parentesco de un toque y confirma', async () => {
    const usuario = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana', { estadoCivil: null, poblacion: null }), hijo(2, 'Bruno')])
    renderWithProviders(<RevisarFichaPage />)

    // Cuatro pasos: tus datos, cuota, familia y confirmar.
    expect(await screen.findByText('Paso 1 de 4')).toBeInTheDocument()
    expect(screen.getByText('Nos faltan algunos datos: estado civil y localidad')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sí, es correcto/ })).toBeDisabled()

    await usuario.click(screen.getByRole('combobox', { name: /Estado civil/ }))
    await usuario.click(await screen.findByRole('option', { name: 'Casado o casada' }))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    await usuario.type(screen.getByLabelText(/Localidad/), 'Málaga')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, es correcto' })).toBeEnabled())
    expect(cuerposPut(simulado)).toEqual([['1', { estadoCivil: 'CASADO', poblacion: 'Málaga' }]])
    await usuario.click(screen.getByRole('button', { name: 'Sí, es correcto' }))
    await screen.findByRole('heading', { level: 1, name: 'Cuota y pago' })
    await usuario.click(screen.getByRole('button', { name: 'Sí, es correcto' }))

    // Bruno: sin decir qué es para Ana no se sigue; se dice de un toque.
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu familia' })).toBeInTheDocument()
    const tarjeta = screen.getByRole('article', { name: 'Bruno Pérez Ruiz' })
    expect(within(tarjeta).getByText('Falta decir qué es para ti')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Correo y domicilio: los mismos que los tuyos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Están bien, seguir' })).toBeDisabled()
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Hijo o hija' }))
    await waitFor(() => expect(within(tarjeta).getByRole('button', { name: 'Hijo o hija' })).toHaveAttribute('aria-pressed', 'true'))
    expect(cuerposPut(simulado).at(-1)).toEqual(['2', { parentesco: 'HIJO' }])
    await usuario.click(screen.getByRole('button', { name: 'Están bien, seguir' }))

    // El repaso dice qué se ha tocado, y sin la declaración no se confirma.
    expect(await screen.findByRole('heading', { level: 1, name: 'Repaso final' })).toBeInTheDocument()
    const repaso = screen.getByRole('list', { name: 'Lo que has revisado' })
    expect(within(repaso).getByText('Tus datos').parentElement).toHaveTextContent('Cambiado')
    expect(within(repaso).getByText('Cuota y pago').parentElement).toHaveTextContent('Sin cambios')
    expect(within(repaso).getByText('Bruno · n.º 302').parentElement).toHaveTextContent('Cambiado')
    expect(screen.getByRole('button', { name: 'Confirmar mi ficha' })).toBeDisabled()
    await usuario.click(screen.getByRole('checkbox', { name: /Declaro que los datos son correctos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar mi ficha' }))

    expect(await screen.findByRole('heading', { name: 'Gracias, Ana. Tu ficha está al día.' })).toBeInTheDocument()
    expect(llamadasA(simulado, '/primer-acceso/confirmar')).toHaveLength(1)
    // Hecho: no queda nada guardado de por dónde iba.
    expect(window.localStorage.length).toBe(0)
  })

  it('lo opcional queda plegado y se guarda solo lo que se escribe', async () => {
    const usuario = userEvent.setup()
    const simulado = responder()
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Tus datos' })
    expect(screen.queryByText(/Nos falta/)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Profesión' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /Puedes añadir también \(opcional\)/ }))
    await usuario.type(await screen.findByRole('textbox', { name: 'Profesión' }), 'Maestra')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(cuerposPut(simulado)).toEqual([['1', { profesion: 'Maestra' }]]))
    expect(await screen.findByText('Maestra')).toBeInTheDocument()
  })

  it('«Hay algo que cambiar» abre los apartados de la ficha con su lápiz, y se vuelve al resumen', async () => {
    const usuario = userEvent.setup()
    responder()
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Tus datos' })
    await usuario.click(screen.getByRole('button', { name: 'Hay algo que cambiar' }))
    expect(screen.getByRole('heading', { name: 'Datos personales' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contacto y domicilio' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sí, es correcto' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Hecho, volver al resumen' }))
    expect(screen.getByRole('button', { name: 'Sí, es correcto' })).toBeInTheDocument()
  })

  it('domiciliada sin decir de quién es la cuenta, la cuota se abre ya para rellenarlo', async () => {
    const usuario = userEvent.setup()
    responder([ficha(1, 'Ana', { titularidadCuenta: null })])
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Tus datos' })
    await usuario.click(screen.getByRole('button', { name: 'Sí, es correcto' }))
    await screen.findByRole('heading', { level: 1, name: 'Cuota y pago' })
    expect(screen.getByText('Para domiciliar la cuota nos falta: de quién es la cuenta.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /De quién es la cuenta/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sí, es correcto' })).not.toBeInTheDocument()
  })

  it('«Son todos mis hijos» los marca de una vez', async () => {
    const usuario = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana'), hijo(2, 'Bruno'), hijo(3, 'Carla', { fechaNacimiento: '2016-04-01T00:00:00.000Z' })])
    renderWithProviders(<RevisarFichaPage />)

    await pasarFichaPropia(usuario)
    await screen.findByRole('heading', { level: 1, name: 'Tu familia' })
    expect(screen.getByText('0 de 2 listos')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Son todos mis hijos' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Están bien, seguir' })).toBeEnabled())
    expect(cuerposPut(simulado)).toEqual([['2', { parentesco: 'HIJO' }], ['3', { parentesco: 'HIJO' }]])
    expect(screen.getByText('Todos, listos.')).toBeInTheDocument()
  })

  it('«No es de mi familia» devuelve la ficha a Secretaría y quita su paso', async () => {
    const usuario = userEvent.setup()
    const simulado = responder()
    renderWithProviders(<RevisarFichaPage />)

    await pasarFichaPropia(usuario)
    await screen.findByRole('heading', { level: 1, name: 'Tu familia' })
    await usuario.click(screen.getByRole('button', { name: 'No es de mi familia' }))
    await usuario.click(await screen.findByRole('button', { name: 'Sí, avisar a Secretaría' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Repaso final' })).toBeInTheDocument()
    expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument()
    expect(llamadasA(simulado, '/primer-acceso/fichas/2/ajena')).toHaveLength(1)
    expect(screen.queryByText('Bruno · n.º 302')).not.toBeInTheDocument()
  })

  it('al volver sigue donde lo dejó', async () => {
    window.localStorage.setItem('primer-acceso:sin-cuenta', JSON.stringify({ actual: 2, alcanzado: 2 }))
    responder()
    renderWithProviders(<RevisarFichaPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Tu familia' })).toBeInTheDocument()
    expect(screen.getByText('Paso 3 de 4')).toBeInTheDocument()
  })

  it('lo cambiado se guarda con el avance: al volver, el repaso sigue diciendo «Cambiado»', async () => {
    const usuario = userEvent.setup()
    responder([ficha(1, 'Ana', { estadoCivil: null })])
    const { unmount } = renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Tus datos' })
    // Con un solo dato que falta, la frase va en singular.
    expect(screen.getByText('Nos falta tu estado civil')).toBeInTheDocument()
    expect(screen.getByText(/El censo no traía ese dato y la Secretaría lo necesita/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('combobox', { name: /Estado civil/ }))
    await usuario.click(await screen.findByRole('option', { name: 'Casado o casada' }))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, es correcto' })).toBeEnabled())
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('primer-acceso:sin-cuenta') ?? '{}')).toMatchObject({ cambiados: ['datos'] }))
    unmount()

    window.localStorage.setItem('primer-acceso:sin-cuenta', JSON.stringify({ actual: 2, alcanzado: 2, cambiados: ['datos'] }))
    responder([ficha(1, 'Ana')])
    renderWithProviders(<RevisarFichaPage />)
    const repaso = await screen.findByRole('list', { name: 'Lo que has revisado' })
    expect(within(repaso).getByText('Tus datos').parentElement).toHaveTextContent('Cambiado')
    expect(within(repaso).getByText('Cuota y pago').parentElement).toHaveTextContent('Sin cambios')
  })

  it('si al confirmar falta algo (409), lleva al paso donde falta con el motivo', async () => {
    const usuario = userEvent.setup()
    window.localStorage.setItem('primer-acceso:sin-cuenta', JSON.stringify({ actual: 2, alcanzado: 2 }))
    const simulado = responder([ficha(1, 'Ana')])
    let lecturas = 0
    simulado.mockImplementation((url: string, init: RequestInit = {}) => {
      if (String(url).includes('/primer-acceso/confirmar')) return Promise.resolve(json({ error: 'Faltan datos obligatorios en tu ficha: localidad.', fichaIncompleta: { id: 1, nombre: 'Ana', esTitular: true, campos: ['poblacion'] } }, 409))
      if (init.method) return Promise.resolve(json({}))
      // La segunda lectura, la de después del 409: otra pestaña dejó la localidad vacía.
      lecturas += 1
      const fichas = [ficha(1, 'Ana', lecturas > 1 ? { poblacion: null } : {})]
      return Promise.resolve(json({ data: fichas, meta: { total: 1, page: 1, limit: 50, totalPages: 1 } }))
    })
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Repaso final' })
    await usuario.click(screen.getByRole('checkbox', { name: /Declaro que los datos son correctos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar mi ficha' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tus datos' })).toBeInTheDocument()
    expect(screen.getByText('Faltan datos obligatorios en tu ficha: localidad.')).toBeInTheDocument()
    expect(screen.getByText('Nos falta tu localidad')).toBeInTheDocument()
  })

  it('si lo que falta al confirmar es de un familiar, lleva a «Tu familia»', async () => {
    const usuario = userEvent.setup()
    window.localStorage.setItem('primer-acceso:sin-cuenta', JSON.stringify({ actual: 3, alcanzado: 3 }))
    const simulado = responder([ficha(1, 'Ana'), hijo(2, 'Bruno', { parentesco: 'HIJO' })])
    simulado.mockImplementation((url: string) => Promise.resolve(String(url).includes('/primer-acceso/confirmar')
      ? json({ error: 'Faltan datos obligatorios en la ficha de Bruno: fecha de nacimiento.', fichaIncompleta: { id: 2, nombre: 'Bruno', esTitular: false, campos: ['fechaNacimiento'] } }, 409)
      : json({ data: [ficha(1, 'Ana'), hijo(2, 'Bruno', { parentesco: 'HIJO' })], meta: { total: 2, page: 1, limit: 50, totalPages: 1 } })))
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Repaso final' })
    await usuario.click(screen.getByRole('checkbox', { name: /Declaro que los datos son correctos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar mi ficha' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tu familia' })).toBeInTheDocument()
    expect(screen.getByText('Faltan datos obligatorios en la ficha de Bruno: fecha de nacimiento.')).toBeInTheDocument()
  })

  it('al pasar de paso, el foco va al título del nuevo', async () => {
    const usuario = userEvent.setup()
    responder()
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Tus datos' })
    await usuario.click(screen.getByRole('button', { name: 'Sí, es correcto' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Cuota y pago' })).toHaveFocus()
  })

  it('lo que falta se guarda con Intro, y cada aviso va en su campo', async () => {
    const usuario = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana', { telefono: null, poblacion: null })])
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Tus datos' })
    const movil = screen.getByRole('textbox', { name: /Teléfono móvil/ })
    await usuario.type(movil, '6000{Enter}')
    expect(await screen.findByText('Tiene que tener 9 cifras.')).toBeInTheDocument()
    expect(movil).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: /Localidad/ })).toHaveAttribute('aria-invalid', 'true')
    expect(movil).toHaveFocus()
    expect(cuerposPut(simulado)).toEqual([])

    await usuario.clear(movil)
    await usuario.type(movil, '600111222')
    await usuario.type(screen.getByRole('textbox', { name: /Localidad/ }), 'Málaga{Enter}')
    await waitFor(() => expect(cuerposPut(simulado)).toEqual([['1', { telefono: '600111222', poblacion: 'Málaga' }]]))
  })

  it('con un solo familiar sin completar no dice «0 de 1 listos», y el número no se pega al nombre', async () => {
    const usuario = userEvent.setup()
    responder()
    renderWithProviders(<RevisarFichaPage />)

    await pasarFichaPropia(usuario)
    await screen.findByRole('heading', { level: 1, name: 'Tu familia' })
    expect(screen.getByText('Falta por completar.')).toBeInTheDocument()
    expect(screen.queryByText(/0 de 1/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /^Bruno Pérez Ruiz n\.º\s302$/ })).toBeInTheDocument()
  })
})
