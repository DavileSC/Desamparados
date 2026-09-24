import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import ProcesionPage from '../ProcesionPage'
import type { FichaEnLaProcesion, FichaEnUnaSalida, MiProcesion, SalidaDelHermano } from '../../../../lib/api/procesion'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const vacia: FichaEnUnaSalida = { solicitud: null, papeleta: null, ultima: null }
const ficha = (id: number, nombre: string, extra: Partial<FichaEnLaProcesion> = {}, pasion: Partial<FichaEnUnaSalida> = {}, rosario: Partial<FichaEnUnaSalida> = {}): FichaEnLaProcesion => ({
  id, nombre, apellidos: 'Benítez Salas', esTitular: true, parentesco: null, activo: true, tieneTunicaPropia: true,
  cuotasPendientes: [], cuotasEnElBanco: 0,
  porSalida: {
    PASION: { ...vacia, ultima: { id: 9, year: 2026, puesto: 'Cirio', tramo: 'Tramo 3' }, ...pasion },
    ROSARIO: { ...vacia, ...rosario },
  },
  ...extra,
})

const DIAS = [
  { id: 1, salida: 'PASION' as const, fecha: '2027-03-08T00:00:00.000Z', horaInicio: '2027-03-08T17:00:00.000Z', horaFin: '2027-03-08T20:00:00.000Z', genteApuntada: 34, capacidad: 100 },
  { id: 2, salida: 'PASION' as const, fecha: '2027-03-09T00:00:00.000Z', horaInicio: '2027-03-09T17:00:00.000Z', horaFin: '2027-03-09T20:00:00.000Z', genteApuntada: 100, capacidad: 100 },
]
const DIA_ROSARIO = { id: 5, salida: 'ROSARIO' as const, fecha: '2026-10-03T00:00:00.000Z', horaInicio: '2026-10-03T16:00:00.000Z', horaFin: '2026-10-03T19:00:00.000Z', genteApuntada: 3, capacidad: 60 }

const salidas = (pasion: Partial<SalidaDelHermano> = {}, rosario: Partial<SalidaDelHermano> = {}): SalidaDelHermano[] => [
  { salida: 'PASION', nombre: 'Sábado de Pasión', abierto: false, year: 2027, dias: [], ...pasion },
  { salida: 'ROSARIO', nombre: 'Rosario vespertino', abierto: false, year: 2026, dias: [], ...rosario },
]

function servidor(estado: Partial<MiProcesion>) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ url: String(url), metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (metodo === 'POST' || metodo === 'DELETE') return Promise.resolve(json({ citaId: 1, total: 20, repetida: false }))
    return Promise.resolve(json({ salidas: salidas(), cuotaSalida: 0, pagoEnLinea: false, fichas: [], ...estado }))
  }))
  return llamadas
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ProcesionPage', () => {
  it('con el plazo cerrado no ofrece pedir nada y enseña la última papeleta', async () => {
    servidor({ fichas: [ficha(1, 'Antonio'), ficha(2, 'Pablo', { esTitular: false, parentesco: 'SOBRINO' }, { ultima: null })] })
    renderWithProviders(<ProcesionPage />)

    expect(await screen.findByText(/aún no está abierta/i)).toBeInTheDocument()
    expect(screen.getByText('2026 · Cirio · Tramo 3')).toBeInTheDocument()
    expect(screen.getByText('Todavía no ha salido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pedir/i })).not.toBeInTheDocument()
  })

  it('abierto, pide la papeleta de cada ficha marcada con el puesto que le gustaría y el día elegido', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({
      salidas: salidas({ abierto: true, dias: DIAS }),
      fichas: [
        ficha(1, 'Antonio'),
        ficha(2, 'Pablo', { esTitular: false, parentesco: 'SOBRINO' }, { ultima: null }),
        ficha(3, 'Carmen', { esTitular: false, parentesco: 'HIJO', activo: false }),
      ],
    })
    renderWithProviders(<ProcesionPage />)

    expect(await screen.findByText(/la solicitud de papeletas está abierta/i)).toBeInTheDocument()
    // Una ficha pendiente de Secretaría no puede salir todavía.
    expect(screen.getByRole('checkbox', { name: /carmen/i })).toBeDisabled()
    // Un día completo no se ofrece.
    expect(screen.getByRole('radio', { name: /9 de marzo/i })).toBeDisabled()
    // Se propone el puesto de la última vez; quien no salió nunca tiene que decirlo.
    expect(screen.getByRole('combobox', { name: /le gustaría a Antonio/ })).toHaveValue('Cirio')
    await user.click(screen.getByRole('radio', { name: /8 de marzo/i }))
    const pedir = screen.getByRole('button', { name: 'Pedir 2 papeletas' })
    expect(pedir).toBeDisabled()
    expect(screen.getByText('Di en qué puesto os gustaría ir.')).toBeInTheDocument()

    await user.type(screen.getByRole('combobox', { name: /le gustaría a Pablo/ }), 'Monaguillo')
    await user.click(await screen.findByRole('option', { name: 'Monaguillo' }))
    await user.click(pedir)

    await waitFor(() => expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(2))
    const cuerpos = llamadas.filter((l) => l.metodo === 'POST').map((l) => l.cuerpo)
    expect(cuerpos).toEqual([{ hermanoId: 1, turnoId: 1, puesto: 'Cirio' }, { hermanoId: 2, turnoId: 1, puesto: 'Monaguillo' }])
    expect(await screen.findByText(/papeletas pedidas/i)).toBeInTheDocument()
  })

  it('una solicitud dice lo que pidió, su día, y si está pendiente de pago; se puede cancelar', async () => {
    const user = userEvent.setup()
    const cita = { id: 77, turno: { id: 1, salida: 'PASION' as const, fecha: DIAS[0].fecha, horaInicio: DIAS[0].horaInicio, horaFin: DIAS[0].horaFin } }
    const solicitud = { id: 4, puesto: 'Nazareno', donativo: null, pendiente: 0, concepto: 'Papeleta Sitio 2027', pagada: false, cita }
    const llamadas = servidor({
      salidas: salidas({ abierto: true, dias: DIAS }),
      fichas: [ficha(1, 'Antonio', { cuotasPendientes: [{ id: 30, year: 2027, concepto: 'Cuota 2027', importe: 20, estado: 'PENDIENTE' }] }, { solicitud })],
    })
    renderWithProviders(<ProcesionPage />)

    const tarjeta = await screen.findByRole('region', { name: 'Este año' })
    expect(within(tarjeta).getByRole('heading', { name: 'Tu solicitud' })).toBeInTheDocument()
    expect(within(tarjeta).getByText(/Pediste: Nazareno \(lo confirma el Grupo en la mesa\) · Lunes, 8 de marzo, de 18:00 a 21:00/)).toBeInTheDocument()
    expect(within(tarjeta).getByText('Pendiente de pago')).toBeInTheDocument()
    // Sin pasarela, se dice dónde pagar.
    expect(screen.getByText(/Puedes pagar en Secretaría o el día del reparto/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancelar la solicitud de antonio/i }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE' && l.url.includes('/procesion/avisar/77'))).toBe(true))
  })

  it('con la pasarela (simulada), paga de una vez las cuotas y la voluntad prometida', async () => {
    const user = userEvent.setup()
    const solicitud = { id: 6, puesto: 'Vela', donativo: 5, pendiente: 5, concepto: 'Donativo Rosario vespertino 2026', pagada: false, cita: null }
    const llamadas = servidor({
      pagoEnLinea: true,
      fichas: [ficha(1, 'Antonio', { cuotasPendientes: [{ id: 30, year: 2026, concepto: 'Cuota 2026', importe: 20, estado: 'PENDIENTE' }] }, {}, { solicitud })],
    })
    renderWithProviders(<ProcesionPage />)

    expect(await screen.findByText(/está en pruebas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pagar 25,00 €' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.url.includes('/recibos/mis-recibos/pagar'))).toBe(true))
    expect(llamadas.find((l) => l.url.includes('/mis-recibos/pagar'))?.cuerpo).toMatchObject({ reciboIds: [30], solicitudIds: [6] })
  })

  it('el Rosario va aparte: su plazo, sus días, sus puestos y la voluntad', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({
      salidas: salidas({}, { abierto: true, dias: [DIA_ROSARIO] }),
      fichas: [ficha(1, 'Antonio')],
    })
    renderWithProviders(<ProcesionPage />)

    // Se abre por la salida con el plazo abierto.
    expect(await screen.findByText(/inscripción del Rosario vespertino está abierta/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Rosario vespertino · abierta/ })).toHaveAttribute('aria-selected', 'true')
    await user.type(screen.getByRole('combobox', { name: /le gustaría a Antonio/ }), 'Vel')
    await user.click(await screen.findByRole('option', { name: 'Vela' }))
    await user.type(screen.getByRole('textbox', { name: /la voluntad/i }), '5')
    await user.click(screen.getByRole('radio', { name: /3 de octubre/i }))
    await user.click(screen.getByRole('button', { name: 'Pedir la papeleta' }))

    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true))
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ hermanoId: 1, turnoId: 5, puesto: 'Vela', donativo: 5 })
  })
})
