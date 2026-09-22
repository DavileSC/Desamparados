import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import ProcesionPage from '../ProcesionPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const ficha = (id: number, nombre: string, extra: Record<string, unknown> = {}) => ({
  id, nombre, apellidos: 'Benítez Salas', esTitular: true, parentesco: null, activo: true, tieneTunicaPropia: true,
  cita: null, papeleta: null, ultima: { id: 9, year: 2026, puesto: 'Cirio', tramo: 'Tramo 3' },
  ...extra,
})

const DIAS = [
  { id: 1, fecha: '2027-03-08T00:00:00.000Z', horaInicio: '2027-03-08T17:00:00.000Z', horaFin: '2027-03-08T20:00:00.000Z', genteApuntada: 34, capacidad: 100 },
  { id: 2, fecha: '2027-03-09T00:00:00.000Z', horaInicio: '2027-03-09T17:00:00.000Z', horaFin: '2027-03-09T20:00:00.000Z', genteApuntada: 100, capacidad: 100 },
]

function servidor(estado: Record<string, unknown>) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (metodo === 'POST' || metodo === 'DELETE') return Promise.resolve(json({ id: 1 }))
    return Promise.resolve(json({ abierto: false, year: 2027, precios: { papeleta: 30, alquilerTunica: 15 }, dias: [], fichas: [], ...estado }))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ProcesionPage', () => {
  it('con el plazo cerrado no ofrece pedir nada y enseña la última papeleta', async () => {
    servidor({ abierto: false, fichas: [ficha(1, 'Antonio'), ficha(2, 'Pablo', { esTitular: false, parentesco: 'SOBRINO', ultima: null })] })
    renderWithProviders(<ProcesionPage />)

    expect(await screen.findByText(/aún no está abierta/i)).toBeInTheDocument()
    expect(screen.getByText('2026 · Cirio · Tramo 3')).toBeInTheDocument()
    expect(screen.getByText('Todavía no ha salido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pedir/i })).not.toBeInTheDocument()
  })

  it('abierto, pide la papeleta de cada ficha marcada para el día elegido', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({
      abierto: true, dias: DIAS,
      fichas: [
        ficha(1, 'Antonio'),
        ficha(2, 'Pablo', { esTitular: false, parentesco: 'SOBRINO' }),
        ficha(3, 'Carmen', { esTitular: false, parentesco: 'HIJO', activo: false }),
      ],
    })
    renderWithProviders(<ProcesionPage />)

    expect(await screen.findByText(/la solicitud de papeletas está abierta/i)).toBeInTheDocument()
    // Una ficha pendiente de Secretaría no puede salir todavía.
    expect(screen.getByRole('checkbox', { name: /carmen/i })).toBeDisabled()
    // Un día completo no se ofrece.
    expect(screen.getByRole('radio', { name: /9 de marzo/i })).toBeDisabled()

    const pedir = screen.getByRole('button', { name: 'Pedir 2 papeletas' })
    expect(pedir).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /8 de marzo/i }))
    await user.click(pedir)

    await waitFor(() => expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(2))
    const cuerpos = llamadas.filter((l) => l.metodo === 'POST').map((l) => l.cuerpo)
    expect(cuerpos).toEqual([{ hermanoId: 1, turnoId: 1 }, { hermanoId: 2, turnoId: 1 }])
    expect(await screen.findByText(/papeletas pedidas/i)).toBeInTheDocument()
  })

  it('con cita reservada enseña el día y deja anularla', async () => {
    const user = userEvent.setup()
    const cita = { id: 77, turno: { id: 1, fecha: DIAS[0].fecha, horaInicio: DIAS[0].horaInicio, horaFin: DIAS[0].horaFin } }
    const llamadas = servidor({ abierto: true, dias: DIAS, fichas: [ficha(1, 'Antonio', { cita })] })
    renderWithProviders(<ProcesionPage />)

    expect(await screen.findByText(/tienes cita para recoger la papeleta/i)).toBeInTheDocument()
    expect(screen.getByText(/lunes, 8 de marzo, de 18:00 a 21:00/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /anular la cita de antonio/i }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE' && l.url.includes('/procesion/avisar/77'))).toBe(true))
  })
})
