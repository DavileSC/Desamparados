import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import FamilyPage from '../FamilyPage'

const usuario = () => userEvent.setup({ delay: null })

const hoy = new Date()
const haceAnios = (anios: number) =>
  new Date(hoy.getFullYear() - anios, hoy.getMonth(), hoy.getDate()).toISOString()

const ficha = (id: number, nombre: string, extra: Record<string, unknown> = {}) => ({
  id, nombre, apellidos: 'Ruiz Montes', email: 'javier@ejemplo.test', telefono: '661223344',
  direccion: 'Calle Alameda 84', poblacion: 'Málaga', codigoPostal: '29013',
  fechaAlta: haceAnios(1), fechaNacimiento: haceAnios(40), numeroHermano: 308, activo: true,
  esTitular: false, parentesco: 'HIJO', ...extra,
})

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const listado = (fichas: unknown[]) =>
  json({ data: fichas, meta: { total: fichas.length, page: 1, limit: 50, totalPages: 1 } })

function responder(fichas: unknown[]) {
  const simulado = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
    Promise.resolve(init?.method === 'POST' ? json(fichas[0]) : listado(fichas)))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('FamilyPage', () => {
  it('separa tu ficha de las de quienes tienes a tu cargo, con su parentesco', async () => {
    responder([
      ficha(1, 'Javier', { esTitular: true, parentesco: null }),
      ficha(2, 'Lucía', { fechaNacimiento: haceAnios(9), numeroHermano: null, activo: false }),
      ficha(3, 'Hugo', { parentesco: 'SOBRINO', fechaNacimiento: haceAnios(10) }),
    ])
    renderWithProviders(<FamilyPage />)

    expect(await screen.findByText('Javier Ruiz Montes')).toBeInTheDocument()
    expect(screen.getByText('Tu ficha')).toBeInTheDocument()
    expect(screen.getByText('Hijo o hija')).toBeInTheDocument()
    expect(screen.getByText('Sobrino o sobrina')).toBeInTheDocument()
    // Lo que de verdad importa de una ficha nueva: si ya está en el censo.
    expect(screen.getByText('Pendiente de Secretaría')).toBeInTheDocument()
  })

  it('sin ficha propia ofrece hacerse hermano, y manda su DNI', async () => {
    const simulado = responder([ficha(2, 'Lucía', { fechaNacimiento: haceAnios(9) })])
    renderWithProviders(<FamilyPage />)
    const u = usuario()

    await u.click(await screen.findByRole('button', { name: /hacerme hermano/i }))
    const dialogo = await screen.findByRole('dialog')
    await u.type(within(dialogo).getByLabelText('Nombre'), 'Javier')
    await u.clear(within(dialogo).getByLabelText('Apellidos'))
    await u.type(within(dialogo).getByLabelText('Apellidos'), 'Ruiz Montes')
    await u.type(within(dialogo).getByLabelText('Fecha de nacimiento'), '1986-11-03')
    await u.type(within(dialogo).getByLabelText('Tu DNI/NIE'), '12345678Z')
    await u.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(simulado.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const [, init] = simulado.mock.calls.find(([, i]) => i?.method === 'POST')!
    const cuerpo = JSON.parse(String(init.body))
    expect(cuerpo.dni).toBe('12345678Z')
    // Su propia ficha no es «de» nadie: va sin parentesco.
    expect(cuerpo.parentesco).toBeUndefined()
  })

  it('no deja apuntar como menor a quien ya tiene 18', async () => {
    responder([ficha(1, 'Javier', { esTitular: true, parentesco: null })])
    renderWithProviders(<FamilyPage />)
    const u = usuario()

    await u.click(await screen.findByRole('button', { name: /apuntar a un menor/i }))
    const dialogo = await screen.findByRole('dialog')
    await u.type(within(dialogo).getByLabelText('Nombre'), 'Andrés')
    await u.type(within(dialogo).getByLabelText('Fecha de nacimiento'), '1995-01-01')
    await u.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialogo).findByText(/el alta la hace la propia persona/i)).toBeInTheDocument()
  })

  it('solo ofrece cuenta propia a quien ya cumplió los 18', async () => {
    responder([
      ficha(1, 'Javier', { esTitular: true, parentesco: null }),
      ficha(2, 'Lucía', { fechaNacimiento: haceAnios(9) }),
    ])
    renderWithProviders(<FamilyPage />)

    await screen.findByText('Lucía Ruiz Montes')
    expect(screen.queryByRole('button', { name: /darle cuenta propia/i })).not.toBeInTheDocument()
  })

  it('a quien los cumple, sí: avisa y abre el diálogo', async () => {
    responder([
      ficha(1, 'Javier', { esTitular: true, parentesco: null }),
      ficha(2, 'Marta', { fechaNacimiento: haceAnios(18) }),
    ])
    renderWithProviders(<FamilyPage />)
    const u = usuario()

    await u.click(await screen.findByRole('button', { name: /darle cuenta propia/i }))
    expect(await screen.findByRole('dialog', { name: /cuenta propia a Marta/i })).toBeInTheDocument()
  })
})
