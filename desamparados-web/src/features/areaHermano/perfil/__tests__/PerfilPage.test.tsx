import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import PerfilPage from '../PerfilPage'
import { FICHAS_POR_FAMILIA } from '../../../../lib/api/perfil'

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
  it('pinta la ficha por apartados, con lo de Secretaría a la vista pero sin editar', async () => {
    responder([ficha(1, 'Ana')])
    renderWithProviders(<PerfilPage />)

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument()
    for (const titulo of ['Datos personales', 'Contacto y domicilio', 'Vida cofrade', 'Cuota y pago']) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument()
    }
    // La cuenta, solo enmascarada; y la jura, con el candado de Secretaría.
    expect(screen.getByText('ES•• •••• •••• •••• •••• 1332')).toBeInTheDocument()
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
    renderWithProviders(<PerfilPage />)

    await waitFor(() => expect(simulado.mock.calls.length).toBeGreaterThan(0))
    const pedida = new URL(String(simulado.mock.calls[0]?.[0]), 'http://localhost')
    expect(pedida.pathname).toContain('/hermanos/mis-perfiles')
    expect(Number(pedida.searchParams.get('limit'))).toBe(FICHAS_POR_FAMILIA)
    expect(pedida.searchParams.get('page')).toBe('1')
  })

  // El servidor ordena por fecha de nacimiento descendente: la primera ficha es
  // la del hijo más pequeño, no la del tutor que ha iniciado sesión.
  it('abre la ficha del titular aunque no sea la primera, y deja pasar a la del sobrino', async () => {
    const user = userEvent.setup()
    responder([
      ficha(2, 'Bruno', { esTitular: false, parentesco: 'SOBRINO', fechaNacimiento: '2014-06-01T00:00:00.000Z', numeroHermano: 118 }),
      ficha(1, 'Ana'),
    ])
    renderWithProviders(<PerfilPage />)

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    const fichas = screen.getByRole('group', { name: /fichas de tu cuenta/i })
    expect(within(fichas).getByRole('button', { name: /ana/i })).toHaveAttribute('aria-current', 'true')

    await user.click(within(fichas).getByRole('button', { name: /bruno.*sobrino/i }))
    expect(await screen.findByText('Bruno Pérez Ruiz')).toBeInTheDocument()
    // Un sobrino no es «hijo»: su ficha dice qué es para quien la lleva.
    expect(screen.getByText('Qué es para ti')).toBeInTheDocument()
    expect(screen.getAllByText('Sobrino o sobrina').length).toBeGreaterThan(0)
  })

  it('cada apartado guarda solo sus campos, y el del sobrino va a su ficha', async () => {
    const user = userEvent.setup()
    const simulado = responder([ficha(1, 'Ana'), ficha(2, 'Bruno', { esTitular: false, parentesco: 'SOBRINO', fechaNacimiento: '2014-06-01T00:00:00.000Z' })])
    renderWithProviders(<PerfilPage />, { ruta: '/area-hermano/perfil?ficha=2' })

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
    renderWithProviders(<PerfilPage />)

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

  // Quien solo apuntó a menores no tiene ficha: antes se le enseñaba la de su
  // hijo como si fuera la suya. Ahora ve las de sus menores, y le ofrece hacerse hermano.
  it('sin ficha propia ofrece hacerse hermano y enseña las de sus menores', async () => {
    responder([ficha(2, 'Bruno', { esTitular: false, parentesco: 'HIJO', fechaNacimiento: '2015-01-01T00:00:00.000Z' })])
    renderWithProviders(<PerfilPage />)

    expect(await screen.findByText(/no tienes ficha de hermano/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /hacerme hermano/i })).toHaveAttribute('href', '/area-hermano/familia')
    expect(screen.getByText('Bruno Pérez Ruiz')).toBeInTheDocument()
  })
})
