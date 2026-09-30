import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import Cortejo from '../Cortejo'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const ESTADO = {
  salida: 'PASION', year: 2027,
  config: { tramos: [{ nombre: 'Cruz de guía', plazas: 30 }, { nombre: 'Tramo del trono', plazas: 30 }], puestos: ['Nazareno'] },
  papeletas: 5,
  reparto: { tramos: [{ nombre: 'Cruz de guía', plazas: 30, asignados: 2 }, { nombre: 'Tramo del trono', plazas: 30, asignados: 2 }], fuera: 1, cambios: 3 },
  actual: [
    { tramo: 'Cruz de guía', hermanos: [{ papeletaId: 1, numero: 1, puesto: 'Nazareno', seReparte: true, nombre: 'Ana', apellidos: 'Ruiz', numeroHermano: 301 }] },
    { tramo: null, hermanos: [{ papeletaId: 5, numero: null, puesto: 'Trono', seReparte: false, nombre: 'Luis', apellidos: 'Gil', numeroHermano: 12 }] },
  ],
}

function api() {
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const ruta = String(url)
    if (ruta.endsWith('/cortejo/aplicar')) return Promise.resolve(json({ message: 'Cortejo repartido: 3 papeletas han cambiado de tramo o de lugar.', cambiadas: 3 }))
    if (ruta.endsWith('/cortejo/configuracion')) return Promise.resolve(json(JSON.parse(String(init.body))))
    return Promise.resolve(json(ESTADO))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => { vi.unstubAllGlobals() })

describe('Cortejo', () => {
  it('enseña los tramos, lo que cambiaría y la lista de ahora, y reparte tras confirmar', async () => {
    const user = userEvent.setup()
    const fetch = api()
    const onAviso = vi.fn()
    renderWithProviders(<Cortejo salida="PASION" puedeCambiar onAviso={onAviso} />)

    expect(await screen.findByText('Cortejo 2027')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cruz de guía')).toBeInTheDocument()
    expect(screen.getAllByText('2 hermanos al repartir')).toHaveLength(2)
    expect(screen.getByText(/5 papeletas: 4 se reparten en los tramos y 1 va en su puesto\. Al repartir, 3 cambian/)).toBeInTheDocument()
    expect(screen.getByText('Sin tramo')).toBeInTheDocument()
    expect(screen.getByText(/· n\.º 12 · Trono/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Repartir por antigüedad' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Repartir' }))
    await waitFor(() => expect(onAviso).toHaveBeenCalledWith('Cortejo repartido: 3 papeletas han cambiado de tramo o de lugar.'))
    const aplicar = fetch.mock.calls.find(([url]) => String(url).endsWith('/cortejo/aplicar'))!
    expect(JSON.parse(String((aplicar[1] as RequestInit).body))).toEqual({ salida: 'PASION', year: 2027 })
  })

  it('con tramos sin guardar no deja repartir, y guardarlos manda la configuración nueva', async () => {
    const user = userEvent.setup()
    const fetch = api()
    renderWithProviders(<Cortejo salida="PASION" puedeCambiar onAviso={() => undefined} />)

    await user.click(await screen.findByRole('button', { name: 'Añadir tramo' }))
    expect(screen.getByText('Guarda los tramos antes de repartir.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Repartir por antigüedad' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar tramos' }))
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/cortejo/configuracion'))).toBe(true))
    const guardar = fetch.mock.calls.find(([url]) => String(url).endsWith('/cortejo/configuracion'))!
    expect(JSON.parse(String((guardar[1] as RequestInit).body)).tramos).toHaveLength(3)
  })

  it('quien no lo gestiona lo ve sin poder tocarlo', async () => {
    api()
    renderWithProviders(<Cortejo salida="PASION" puedeCambiar={false} onAviso={() => undefined} />)
    expect(await screen.findByDisplayValue('Cruz de guía')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Repartir por antigüedad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir tramo' })).not.toBeInTheDocument()
  })
})
