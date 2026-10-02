import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import VistaDifuntos from '../VistaDifuntos'

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
const ANDRES = {
  id: 5, nombre: 'Andrés', apellidos: 'Gil Ruiz', sexo: 'HOMBRE', fechaDefuncion: '2026-09-20T10:00:00.000Z', aniosDeHermano: 21,
  aniversario: { dia: '2027-09-20', anios: 1, faltan: 354 }, sufragios: 1,
}
const FICHA = {
  ...ANDRES, fechaAlta: '2005-05-03T10:00:00.000Z',
  familia: { nombre: 'Carmen Gil Ruiz', email: 'carmen@example.com' },
  sufragios: [{ id: 30, tipo: 'MISA_FUNERAL', nombreTipo: 'Misa funeral', fecha: '2026-09-22T17:00:00.000Z', lugar: 'Parroquia', notas: null, eventoId: 44, familiaAvisada: '2026-09-21T09:00:00.000Z' }],
}

function servidor() {
  const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (String(url).includes('/aniversarios')) return Promise.resolve(json([{ ...ANDRES, nombre: 'Rosa', apellidos: 'Pérez', id: 6, aniversario: { dia: '2026-10-05', anios: 3, faltan: 4 } }]))
    if (metodo === 'POST' && String(url).includes('/sufragios')) return Promise.resolve(json({ id: 31, eventoId: 45, familiaAvisada: true }))
    if (metodo !== 'GET') return Promise.resolve(json({ message: 'ok' }))
    if (/\/difuntos\/\d+$/.test(String(url))) return Promise.resolve(json(FICHA))
    return Promise.resolve(json([ANDRES]))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('VistaDifuntos', () => {
  it('enseña los próximos aniversarios y el registro, y abre la ficha con sus sufragios', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<VistaDifuntos puedeGestionar />)

    const proximos = await screen.findByRole('region', { name: 'Próximos aniversarios' })
    expect(await within(proximos).findByText(/3 años · en 4 días/)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Andrés Gil Ruiz/ }))

    const ficha = await screen.findByRole('article', { name: 'Ficha de Andrés Gil Ruiz' })
    expect(within(ficha).getByText(/21 años de hermano/)).toBeInTheDocument()
    expect(within(ficha).getByText('Misa funeral')).toBeInTheDocument()
    expect(within(ficha).getByText(/En la Agenda · Familia avisada/)).toBeInTheDocument()
    expect(within(ficha).getByText(/Se le escribe a Carmen Gil Ruiz \(carmen@example.com\)/)).toBeInTheDocument()
  })

  it('un sufragio nuevo parte de la misa de su aniversario, en la Agenda y avisando a la familia', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<VistaDifuntos puedeGestionar />)
    await user.click(await screen.findByRole('button', { name: /Andrés Gil Ruiz/ }))
    await user.click(await screen.findByRole('button', { name: 'Nuevo sufragio' }))

    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByRole('textbox', { name: 'Lugar' }), 'Parroquia')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({
      tipo: 'MISA_ANIVERSARIO', fecha: '2027-09-20T19:30', lugar: 'Parroquia', notas: null, enAgenda: true, avisarA: 'carmen@example.com',
    }))
    expect(await screen.findByText(/Misa de aniversario apuntada\. Ya está en la Agenda\. Familia avisada\./)).toBeInTheDocument()
  })

  it('sin la Agenda no ofrece publicarlo en ella, ni lo pide', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<VistaDifuntos puedeGestionar />, { modulos: ['difuntos'] })
    await user.click(await screen.findByRole('button', { name: /Andrés Gil Ruiz/ }))
    await user.click(await screen.findByRole('button', { name: 'Nuevo sufragio' }))

    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).queryByRole('checkbox', { name: 'Publicarlo en la Agenda de la web' })).not.toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({ enAgenda: false }))
  })

  it('el pésame va a la familia, y se puede cambiar la dirección', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<VistaDifuntos puedeGestionar />)
    await user.click(await screen.findByRole('button', { name: /Andrés Gil Ruiz/ }))
    await user.click(await screen.findByRole('button', { name: 'Enviar el pésame' }))

    const campo = within(await screen.findByRole('dialog')).getByRole('textbox', { name: 'Correo de la familia' })
    expect(campo).toHaveValue('carmen@example.com')
    await user.clear(campo)
    await user.type(campo, 'otra@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/difuntos/5/pesame'))?.cuerpo).toEqual({ email: 'otra@example.com' }))
    expect(await screen.findByText('Pésame enviado a otra@example.com.')).toBeInTheDocument()
  })

  it('quien solo mira no ve los botones de gestión', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<VistaDifuntos puedeGestionar={false} />)
    await user.click(await screen.findByRole('button', { name: /Andrés Gil Ruiz/ }))
    await screen.findByRole('article', { name: 'Ficha de Andrés Gil Ruiz' })
    expect(screen.queryByRole('button', { name: 'Nuevo sufragio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar el pésame' })).not.toBeInTheDocument()
  })
})
