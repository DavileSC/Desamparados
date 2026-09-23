import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import CalendarioMes from '../CalendarioMes'

const calendario = {
  mes: '2026-10',
  eventos: [
    { id: 1, title: 'Cabildo General', startDate: '2026-10-03T18:30:00.000Z', type: 'REUNION' as const },
    { id: 2, title: 'Triduo', startDate: '2026-10-16T18:00:00.000Z', type: 'CULTO' as const },
  ],
  diasDeReparto: ['2026-10-20'],
}
const montar = (role?: string) =>
  renderWithProviders(<TemaCmsProvider><CalendarioMes calendario={calendario} role={role} hoy={new Date(2026, 9, 1)} /></TemaCmsProvider>)

describe('CalendarioMes', () => {
  it('pinta el mes con sus actos y sus días de reparto', () => {
    montar('SECRETARIA')
    expect(screen.getByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument()
    expect(screen.getByText('Cabildo General')).toBeInTheDocument()
    expect(screen.getByLabelText('20 de octubre, reparto de papeletas')).toBeInTheDocument()
    expect(screen.getByText('Reparto de papeletas')).toBeInTheDocument()
  })

  it('empieza en lunes: octubre de 2026 arranca en jueves, tras tres huecos', () => {
    const { container } = montar()
    const rejilla = container.querySelector('[aria-labelledby="calendario-mes"] > div:nth-of-type(2)')!
    // Siete cabeceras de día y tres huecos antes del día 1.
    expect(rejilla.children[10].textContent).toBe('1')
  })

  it('el enlace a la Agenda solo lo ve quien puede entrar en ella', () => {
    montar('TESORERIA')
    expect(screen.queryByRole('link', { name: 'Agenda →' })).not.toBeInTheDocument()
  })
})
