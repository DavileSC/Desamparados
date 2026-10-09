import { describe, it, expect, vi, afterEach } from 'vitest'
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
    sexo: 'MUJER', estadoCivil: null, profesion: null, lugarNacimiento: null,
    fechaBautismo: null, parroquiaBautismo: null, fechaJura: null,
    presentadoPor: null, presentadoPor2: null,
    tieneTunicaPropia: false, tunica: null, alturaHombro: null, puesto: null,
    formaPagoPref: 'DOMICILIACION', ibanEnmascarado: 'ES•• •••• •••• •••• •••• 1332', titularCuenta: null,
    ...extra,
  }
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** La familia de Ana: ella y su hijo Bruno, que el censo colgó de su cuenta sin decir qué es para ella. */
function responder() {
  const fichas = [ficha(1, 'Ana'), ficha(2, 'Bruno', { esTitular: false, dni: null, numeroHermano: 300, fechaNacimiento: '2014-02-01T00:00:00.000Z' })]
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

/** Los cuatro apartados de la ficha propia, con «Sí, es correcto». */
async function pasarFichaPropia(usuario: ReturnType<typeof userEvent.setup>) {
  for (const titulo of ['Datos personales', 'Contacto y domicilio', 'Vida cofrade', 'Cuota y pago']) {
    await screen.findByRole('heading', { level: 1, name: titulo })
    await usuario.click(screen.getByRole('button', { name: 'Sí, es correcto' }))
  }
}

afterEach(() => { vi.unstubAllGlobals() })

describe('RevisarFichaPage', () => {
  it('recorre la ficha propia, pide el parentesco del familiar y confirma', async () => {
    const usuario = userEvent.setup()
    const simulado = responder()
    renderWithProviders(<RevisarFichaPage />)

    expect(await screen.findByText('Paso 1 de 6')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pasos de la revisión' })).toBeInTheDocument()
    await pasarFichaPropia(usuario)

    // Bruno: sin decir qué es para Ana no se puede dar por bueno.
    expect(await screen.findByRole('heading', { level: 1, name: 'Bruno Pérez Ruiz' })).toBeInTheDocument()
    expect(screen.getByText(/Falta decir qué es Bruno para ti/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sí, es correcto' })).toBeDisabled()

    await usuario.click(screen.getByRole('combobox', { name: 'Qué es para ti' }))
    await usuario.click(await screen.findByRole('option', { name: 'Hijo o hija' }))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, es correcto' })).toBeEnabled())
    const put = simulado.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    expect(JSON.parse(String((put![1] as RequestInit).body))).toMatchObject({ parentesco: 'HIJO' })
    await usuario.click(screen.getByRole('button', { name: 'Sí, es correcto' }))

    // El repaso dice qué se ha tocado, y sin la declaración no se confirma.
    expect(await screen.findByRole('heading', { level: 1, name: 'Repaso final' })).toBeInTheDocument()
    const repaso = screen.getByRole('list', { name: 'Lo que has revisado' })
    expect(within(repaso).getByText('Bruno · n.º 300').parentElement).toHaveTextContent('Cambiado')
    expect(within(repaso).getByText('Contacto y domicilio').parentElement).toHaveTextContent('Sin cambios')
    expect(screen.getByRole('button', { name: 'Confirmar mi ficha' })).toBeDisabled()
    await usuario.click(screen.getByRole('checkbox', { name: /Declaro que los datos son correctos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar mi ficha' }))

    expect(await screen.findByRole('heading', { name: 'Gracias, Ana. Tu ficha está al día.' })).toBeInTheDocument()
    expect(llamadasA(simulado, '/primer-acceso/confirmar')).toHaveLength(1)
  })

  it('«Hay algo que cambiar» abre los campos del paso, y cancelar vuelve a la pregunta', async () => {
    const usuario = userEvent.setup()
    responder()
    renderWithProviders(<RevisarFichaPage />)

    await screen.findByRole('heading', { level: 1, name: 'Datos personales' })
    // Sin lápiz: aquí se cambia con la pregunta.
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Hay algo que cambiar' }))
    expect(screen.getByRole('textbox', { name: /Nombre/ })).toHaveValue('Ana')
    expect(screen.queryByRole('button', { name: 'Sí, es correcto' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Sí, es correcto' })).toBeInTheDocument()
  })

  it('«No es de mi familia» devuelve la ficha a Secretaría y quita su paso', async () => {
    const usuario = userEvent.setup()
    const simulado = responder()
    renderWithProviders(<RevisarFichaPage />)

    await pasarFichaPropia(usuario)
    await screen.findByRole('heading', { level: 1, name: 'Bruno Pérez Ruiz' })
    await usuario.click(screen.getByRole('button', { name: 'No es de mi familia: avisar a Secretaría' }))
    await usuario.click(await screen.findByRole('button', { name: 'Sí, avisar a Secretaría' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Repaso final' })).toBeInTheDocument()
    expect(llamadasA(simulado, '/primer-acceso/fichas/2/ajena')).toHaveLength(1)
    expect(screen.queryByText('Bruno · n.º 300')).not.toBeInTheDocument()
  })
})
