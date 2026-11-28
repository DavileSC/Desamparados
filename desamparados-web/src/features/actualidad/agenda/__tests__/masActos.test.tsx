import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import type { ApiEvent } from '../../../../lib/api/agenda'
import { isoEnMadrid } from '../../../../lib/horaDeMadrid'
import CalendarioDeCultos from '../CalendarioDeCultos'

// Seis actos el mismo día: en la casilla de escritorio caben tres líneas
// (semana de 112 px), así que salen dos y el tercer hueco es «+4 más».
const actos: ApiEvent[] = Array.from({ length: 6 }, (_, i) => ({
  id: 100 + i, title: `Acto ${i + 1}`, description: null, location: null,
  startDate: isoEnMadrid(`2026-10-16T${String(10 + i).padStart(2, '0')}:00`), endDate: null, type: 'OTRO', cartel: false,
}))

describe('un día con más actos de los que caben', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 1, 12))
  })
  afterEach(() => { vi.useRealTimers() })

  it('enseña los que caben y «+N más», que abre la lista del día y desde ella cada acto', async () => {
    const usuario = userEvent.setup()
    renderWithProviders(<CalendarioDeCultos eventos={actos} />)

    expect(screen.getByRole('button', { name: /^16 de octubre: Acto 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^16 de octubre: Acto 2/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^16 de octubre: Acto 3/ })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: '16 de octubre: 4 actos más' }))
    const lista = screen.getByRole('dialog', { name: /Actos del viernes, 16 de octubre/ })
    expect(within(lista).getAllByRole('button')).toHaveLength(6)

    await usuario.click(within(lista).getByRole('button', { name: /Acto 5/ }))
    expect(screen.queryByRole('dialog', { name: /Actos del/ })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Acto 5' })).toBeInTheDocument()
  })
})
