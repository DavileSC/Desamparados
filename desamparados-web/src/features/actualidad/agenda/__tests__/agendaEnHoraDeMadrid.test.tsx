import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import type { ApiEvent } from '../../../../lib/api/agenda'
import { isoEnMadrid } from '../../../../lib/horaDeMadrid'
import { caeEnElDia, cuandoEnCartel, hora } from '../cultos'
import CalendarioDeCultos from '../CalendarioDeCultos'

// Desde Canarias, una hora menos que en Madrid: una vigilia a las 00:30 del 3
// de octubre en Madrid es, allí, las 23:30 del 2. Con la zona del equipo de
// pruebas (Madrid en local, UTC en el CI) no se distinguiría leer en Madrid de
// leer en local.
const zonaDeAntes = process.env.TZ
beforeAll(() => { process.env.TZ = 'Atlantic/Canary' })
afterAll(() => { process.env.TZ = zonaDeAntes })

const vigilia: ApiEvent = {
  id: 1, title: 'Vigilia de la Titular', description: null, location: null,
  startDate: isoEnMadrid('2026-10-03T00:30'), endDate: null, type: 'CULTO', cartel: false,
}

describe('la Agenda pública se lee en hora de Madrid', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 26, 12))
  })
  afterEach(() => { vi.useRealTimers() })

  it('el día y la hora de un acto son los de Madrid, no los de quien mira', () => {
    expect(new Date(vigilia.startDate).getDate()).toBe(2)
    expect(cuandoEnCartel(vigilia)).toBe('Sábado 3 de octubre')
    expect(hora(vigilia)).toBe('00:30')
    expect(caeEnElDia(vigilia, new Date(2026, 9, 3))).toBe(true)
    expect(caeEnElDia(vigilia, new Date(2026, 9, 2))).toBe(false)
  })

  it('el calendario lo pone en su casilla de Madrid, y la ventana con su hora', async () => {
    const usuario = userEvent.setup()
    renderWithProviders(<CalendarioDeCultos eventos={[vigilia]} />)
    await usuario.click(screen.getByRole('button', { name: /^3 de octubre: Vigilia de la Titular/ }))
    const ventana = screen.getByRole('dialog', { name: 'Vigilia de la Titular' })
    expect(within(ventana).getByText('Sábado 3 de octubre, a las 00:30')).toBeInTheDocument()
  })
})
