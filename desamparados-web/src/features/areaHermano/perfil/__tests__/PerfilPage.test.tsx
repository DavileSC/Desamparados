import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../../test/test-utils'
import PerfilPage from '../PerfilPage'
import { FICHAS_POR_FAMILIA } from '../../../../lib/api/perfil'
import { useAuthStore } from '../../../altas/auth/store'

function ficha(id: number, nombre: string, extra: Record<string, unknown> = {}) {
  return {
    esTitular: true, parentesco: null,
    id, nombre,
    apellidos: 'Pérez Ruiz', primerApellido: 'Pérez', segundoApellido: 'Ruiz',
    dni: '12345678Z', email: `${nombre.toLowerCase()}@ejemplo.test`, email2: null,
    telefono: '600000000', telefonoFijo: null,
    direccion: 'Calle Mayor 1', poblacion: 'Málaga', codigoPostal: '29001', provincia: 'Málaga', pais: 'España',
    fechaAlta: '2020-03-01T00:00:00.000Z', fechaNacimiento: '1980-05-10T00:00:00.000Z',
    numeroHermano: 42, activo: true,
    sexo: 'MUJER', estadoCivil: null, profesion: null, lugarNacimiento: null,
    fechaBautismo: null, parroquiaBautismo: null, fechaJura: '2001-03-19T00:00:00.000Z',
    presentadoPor: 'José Luis Carmona', presentadoPor2: null,
    tieneTunicaPropia: false, tunica: 'L', alturaHombro: null, puesto: null,
    formaPagoPref: 'DOMICILIACION', ibanEnmascarado: 'ES•• •••• •••• •••• •••• 1332', titularCuenta: null,
    ...extra,
  }
}

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

/**
 * Una instancia de `Response` por llamada: `llamarApi` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda. Un
 * PUT devuelve la ficha con lo que se mandó encima.
 */
function responder(fichas: ReturnType<typeof ficha>[]) {
  const simulado = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    if (init.method === 'PUT') {
      const id = Number(String(url).split('/').pop())
      const cambios = JSON.parse(String(init.body)) as Record<string, unknown>
      return Promise.resolve(json({ message: 'ok', data: { ...fichas.find((f) => f.id === id), ...cambios } }))
    }
    return Promise.resolve(json({ data: fichas, meta: { total: fichas.length, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 } }))
  })
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const cuerpoDelPut = (simulado: ReturnType<typeof responder>) => {
  const llamada = simulado.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
  return llamada ? JSON.parse(String((llamada[1] as RequestInit).body)) as Record<string, unknown> : null
}

afterEach(() => { vi.unstubAllGlobals() })

describe('PerfilPage', () => {
  it('pinta la ficha por apartados en pestañas, con lo de Secretaría a la vista pero sin editar', async () => {
    const user = userEvent.setup()
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    // La credencial: lo de Secretaría de un vistazo.
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Alta el 1 de marzo de 2020')).toBeInTheDocument()
    expect(screen.getByText('Jura en 2001')).toBeInTheDocument()
    expect(screen.getByText('Hermano n.º')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    // La cuenta ya no es una pestaña: tiene su pantalla en el menú.
    expect(screen.queryByRole('tab', { name: 'Cuenta y contraseña' })).not.toBeInTheDocument()
    // Apuntar a un menor se hace en Mi familia, que está en el menú.
    expect(screen.queryByRole('link', { name: 'Apuntar a un menor' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Datos personales' })).toHaveAttribute('aria-selected', 'true')
    for (const titulo of ['Datos personales', 'Contacto y domicilio', 'Vida de hermano', 'Cuota y pago']) {
      await user.click(screen.getByRole('tab', { name: titulo }))
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument()
    }

    await user.click(screen.getByRole('tab', { name: 'Contacto y domicilio' }))
    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument()
    // La cuenta, solo enmascarada; y la jura, con el candado de Secretaría.
    await user.click(screen.getByRole('tab', { name: 'Cuota y pago' }))
    expect(screen.getByText('ES•• •••• •••• •••• •••• 1332')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Vida de hermano' }))
    expect(screen.getByText('19/03/2001')).toBeInTheDocument()
    expect(screen.getByText(/los lleva Secretaría/i)).toBeInTheDocument()
  })

  /**
   * Esta pantalla no lista fichas: elige una sobre la que operar. Si pidiera una
   * página corta, el tutor con más fichas que caben en ella dejaría de poder
   * llegar a alguna y aquí no hay paginador con el que ir a buscarla.
   */
  it('pide la familia entera, no una página corta', async () => {
    const simulado = responder([ficha(1, 'Ana'), ficha(2, 'Bruno', { esTitular: false }), ficha(3, 'Carla', { esTitular: false })])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    // Junto a la familia se pide también lo de los avisos del móvil: se busca la de la familia.
    const deLaFamilia = () => simulado.mock.calls.find(([url]) => String(url).includes('/hermanos/mis-perfiles'))
    await waitFor(() => expect(deLaFamilia()).toBeDefined())
    const pedida = new URL(String(deLaFamilia()![0]), 'http://localhost')
    expect(Number(pedida.searchParams.get('limit'))).toBe(FICHAS_POR_FAMILIA)
    expect(pedida.searchParams.get('page')).toBe('1')
  })

  // El servidor ordena por fecha de nacimiento descendente: la primera ficha es
  // la del hijo más pequeño, no la del tutor que ha iniciado sesión.
  // La ficha se elige en el menú del área (MarcoAreaHermano); aquí llega en ?ficha=.
  it('abre la ficha del titular aunque no sea la primera, y con ?ficha= la del sobrino', async () => {
    const fichas = [
      ficha(2, 'Bruno', { esTitular: false, parentesco: 'SOBRINO', fechaNacimiento: '2014-06-01T00:00:00.000Z', numeroHermano: 118 }),
      ficha(1, 'Ana'),
    ]
    responder(fichas)
    const { unmount } = renderWithProviders(<PerfilPage />, { routerDeDatos: true })
    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    // El selector ya no está en la pantalla: está en el menú.
    expect(screen.queryByRole('combobox', { name: /ficha que estás viendo/i })).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?ficha=2' })
    expect(await screen.findByText('Bruno Pérez Ruiz')).toBeInTheDocument()
    // Un sobrino no es «hijo»: su ficha dice qué es para quien la lleva.
    expect(screen.getByText('Qué es para ti')).toBeInTheDocument()
    expect(screen.getAllByText('Sobrino o sobrina').length).toBeGreaterThan(0)
  })

  it('cada apartado guarda solo sus campos, y el del sobrino va a su ficha', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana'), ficha(2, 'Bruno', { esTitular: false, parentesco: 'SOBRINO', fechaNacimiento: '2014-06-01T00:00:00.000Z' })])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?ficha=2&apartado=contacto' })

    await screen.findByText('Bruno Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar contacto y domicilio/i }))
    const fijo = screen.getByLabelText('Teléfono fijo')
    await user.type(fijo, '952 12 34 56')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(cuerpoDelPut(simulado)).not.toBeNull())
    const put = simulado.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')!
    expect(String(put[0])).toContain('/hermanos/mis-perfiles/2')
    const cuerpo = cuerpoDelPut(simulado)!
    expect(cuerpo.telefonoFijo).toBe('952123456')
    // Solo lo del apartado: ni el nombre ni la cuenta bancaria viajan.
    expect(cuerpo).not.toHaveProperty('nombre')
    expect(cuerpo).not.toHaveProperty('iban')
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado.')
  })

  it('la cuenta bancaria no se reenvía si no se escribe una nueva, y una mal copiada no se guarda', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?apartado=cuota' })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar cuota y pago/i }))
    await user.type(screen.getByLabelText('IBAN nuevo'), 'ES91 2100 0418 4502 0005 1333')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/los dígitos de control no cuadran/i)).toBeInTheDocument()
    expect(cuerpoDelPut(simulado)).toBeNull()

    await user.clear(screen.getByLabelText('IBAN nuevo'))
    await user.type(screen.getByLabelText('Nombre del titular'), 'Ana Pérez')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(cuerpoDelPut(simulado)).not.toBeNull())
    expect(cuerpoDelPut(simulado)).toEqual({ formaPagoPref: 'DOMICILIACION', titularidadCuenta: null, titularCuenta: 'Ana Pérez' })
  })

  // Sin Procesión ni Cuotas en línea (ni Remesas) instalados, esos dos apartados no existen.
  it('sin Procesión ni Cuotas en línea, no hay Vida de hermano ni Cuota y pago', async () => {
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, modulos: ['area-hermanos'] })

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('aria-label'))).toEqual(['Datos personales', 'Contacto y domicilio'])
  })

  // Con remesas y sin pago en línea, el IBAN se carga en la domiciliación: el hermano tiene que poder cambiarlo.
  it('con Remesas, aunque no haya Cuotas en línea, está Cuota y pago', async () => {
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, modulos: ['area-hermanos', 'remesas'] })

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Cuota y pago' })).toBeInTheDocument()
  })

  // Quien solo apuntó a menores no tiene ficha: antes se le enseñaba la de su
  // hijo como si fuera la suya. Ahora ve las de sus menores, y le ofrece hacerse hermano.
  it('sin ficha propia ofrece hacerse hermano y enseña las de sus menores', async () => {
    responder([ficha(2, 'Bruno', { esTitular: false, parentesco: 'HIJO', fechaNacimiento: '2015-01-01T00:00:00.000Z' })])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    expect(await screen.findByText(/no tienes ficha de hermano/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /hacerme hermano/i })).toHaveAttribute('href', '/area-hermano/familia')
    expect(screen.getByText('Bruno Pérez Ruiz')).toBeInTheDocument()
  })

  // Un DNI de otra ficha ya no responde 409 «Ese DNI ya está registrado» (decía
  // quién está en el censo): es un 400 con otro texto, y hay un tope diario.
  it.each([
    [400, 'No se ha podido guardar ese DNI. Si es correcto, habla con Secretaría.'],
    [429, 'Has cambiado demasiados DNI por hoy. Inténtalo mañana.'],
  ])('un DNI que el servidor no guarda (%i) enseña su mensaje tal cual', async (status, mensaje) => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana')])
    simulado.mockImplementation((_url: string, init: RequestInit = {}) => Promise.resolve(init.method === 'PUT'
      ? new Response(JSON.stringify({ error: mensaje }), { status, headers: { 'Content-Type': 'application/json' } })
      : json({ data: [ficha(1, 'Ana')], meta: { total: 1, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 } })))
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar datos personales/i }))
    const dni = screen.getByLabelText(/DNI o NIE/)
    await user.clear(dni)
    await user.type(dni, '00000000T')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })
})

describe('PerfilPage: lo que se arregló en la revisión de octubre', () => {
  const putsDe = (simulado: ReturnType<typeof responder>) => simulado.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')

  it('el correo de la ficha es el de contacto, y el de entrar se ve aparte y no se cambia aquí', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ status: 'listo', cms: null, hermano: { id: 9, email: 'cuenta@ejemplo.test', role: 'USER', perfiles: [] } })
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?apartado=contacto' })

    expect(await screen.findByText('cuenta@ejemplo.test')).toBeInTheDocument()
    expect(screen.getByText('Correo con el que entras')).toBeInTheDocument()
    expect(screen.getByText('Correo de contacto')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /editar contacto y domicilio/i }))
    expect(screen.getByRole('textbox', { name: /Correo de contacto/ })).toHaveValue('ana@ejemplo.test')
    expect(screen.getByText(/Para cambiarlo, habla con Secretaría/)).toBeInTheDocument()
    useAuthStore.setState({ hermano: null })
  })

  it('un DNI guardado con la letra mal no impide guardar lo demás, ni se reenvía, y se marca en rojo', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana', { dni: '12345678A' })])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar datos personales/i }))
    expect(screen.getByRole('textbox', { name: /DNI o NIE/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/La letra no corresponde con el número/)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Profesión' }), 'Maestra')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(cuerpoDelPut(simulado)).not.toBeNull())
    expect(cuerpoDelPut(simulado)).toMatchObject({ profesion: 'Maestra' })
    expect(cuerpoDelPut(simulado)).not.toHaveProperty('dni')
  })

  it('el error va en el campo que falla, con su motivo, y el foco a él', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?apartado=contacto' })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar contacto y domicilio/i }))
    const direccion = screen.getByRole('textbox', { name: /Dirección/ })
    await user.type(direccion, ' <b>')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('La dirección no puede llevar «<» ni «>».')).toBeInTheDocument()
    expect(direccion).toHaveAttribute('aria-invalid', 'true')
    expect(direccion).toHaveFocus()
    expect(putsDe(simulado)).toHaveLength(0)
  })

  it('Editar lleva el foco al primer campo, y Cancelar lo devuelve al lápiz', async () => {
    const user = userEvent.setup()
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar datos personales/i }))
    expect(screen.getByRole('textbox', { name: /^Nombre/ })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: /editar datos personales/i })).toHaveFocus()
  })

  it('guardar sin cambiar nada no manda nada ni dice «Guardado»', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar datos personales/i }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('button', { name: /editar datos personales/i })).toBeInTheDocument()
    expect(putsDe(simulado)).toHaveLength(0)
    expect(screen.queryByText('Guardado.')).not.toBeInTheDocument()
  })

  it('pagando en efectivo no enseña la cuenta vacía, y si queda una se puede quitar', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana', { formaPagoPref: 'EFECTIVO', ibanEnmascarado: null })])
    const { unmount } = renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?apartado=cuota' })
    await screen.findByText('Ana Pérez Ruiz')
    expect(screen.queryByText('IBAN')).not.toBeInTheDocument()
    expect(screen.queryByText('Titular de la cuenta')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /editar cuota y pago/i }))
    expect(screen.queryByRole('textbox', { name: /IBAN/ })).not.toBeInTheDocument()
    unmount()
    expect(putsDe(simulado)).toHaveLength(0)

    const otro = responder([ficha(1, 'Ana', { formaPagoPref: 'EFECTIVO' })])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?apartado=cuota' })
    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar cuota y pago/i }))
    await user.click(screen.getByRole('checkbox', { name: /Quitar la cuenta/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(cuerpoDelPut(otro)).toEqual({ formaPagoPref: 'EFECTIVO', iban: null, titularidadCuenta: null, titularCuenta: null }))
  })

  it('con una edición a medias, cambiar de pestaña pregunta antes y no pierde lo escrito', async () => {
    const user = userEvent.setup()
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar datos personales/i }))
    await user.type(screen.getByRole('textbox', { name: 'Profesión' }), 'Maestra')
    await user.click(screen.getByRole('tab', { name: 'Contacto y domicilio' }))

    expect(await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Profesión' })).toHaveValue('Maestra')
    expect(screen.getByRole('tab', { name: 'Datos personales' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: 'Contacto y domicilio' }))
    await user.click(await screen.findByRole('button', { name: 'Salir sin guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Contacto y domicilio' })).toHaveAttribute('aria-selected', 'true')
  })

  it('sin nada a medias, cambiar de pestaña no pregunta', async () => {
    const user = userEvent.setup()
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar datos personales/i }))
    await user.click(screen.getByRole('tab', { name: 'Contacto y domicilio' }))
    expect(screen.getByRole('tab', { name: 'Contacto y domicilio' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un ?ficha= que no es de la cuenta se quita de la dirección', async () => {
    responder([ficha(1, 'Ana')])
    function Direccion() { return <span data-testid="direccion">{useLocation().search}</span> }
    renderWithProviders(<><PerfilPage /><Direccion /></>, { routerDeDatos: true, ruta: '/area-hermano/perfil?ficha=77&apartado=contacto' })

    await screen.findByText('Ana Pérez Ruiz')
    await waitFor(() => expect(screen.getByTestId('direccion')).toHaveTextContent('?apartado=contacto'))
  })

  it('el panel de la pestaña se alcanza con el tabulador', async () => {
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true })
    await screen.findByText('Ana Pérez Ruiz')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0')
  })

  it('las fechas se validan como en el servidor: el bautismo no puede ser anterior al nacimiento', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?apartado=hermano' })

    await screen.findByText('Ana Pérez Ruiz')
    await user.click(screen.getByRole('button', { name: /editar vida de hermano/i }))
    await user.type(screen.getByLabelText('Fecha de bautismo'), '1970-01-01')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('No puede ser anterior al nacimiento.')).toBeInTheDocument()
    expect(putsDe(simulado)).toHaveLength(0)
  })

  it('a un menor no se le pide estado civil ni profesión, y sus fotos son «sus fotos»', async () => {
    const user = userEvent.setup()
    responder([ficha(1, 'Ana'), ficha(2, 'Bruno', { esTitular: false, parentesco: 'HIJO', fechaNacimiento: '2015-01-01T00:00:00.000Z' })])
    renderWithProviders(<PerfilPage />, { routerDeDatos: true, ruta: '/area-hermano/perfil?ficha=2' })

    await screen.findByText('Bruno Pérez Ruiz')
    expect(screen.queryByText('Estado civil')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /editar datos personales/i }))
    expect(screen.queryByRole('combobox', { name: /Estado civil/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Profesión' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('tab', { name: 'Contacto y domicilio' }))
    expect(screen.getByText('Publicar sus fotos')).toBeInTheDocument()
  })
})
