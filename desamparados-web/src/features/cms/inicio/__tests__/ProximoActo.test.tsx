import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import ProximoActo from '../ProximoActo'
import type { Acto } from '../tandas'

const TRIDUO: Acto = {
  fecha: new Date(2026, 9, 16), titulo: 'Solemne triduo', tipo: 'CULTO', hora: '19:00', lugar: 'Parroquia de los Padres Pasionistas', p: 0.55, pasado: false,
}
const montar = (acto: Acto | undefined, hoy: Date) =>
  renderWithProviders(<TemaCmsProvider><ProximoActo acto={acto} hoy={hoy} /></TemaCmsProvider>)

describe('ProximoActo', () => {
  it('enseña el día, la hora, el título y el lugar', () => {
    montar(TRIDUO, new Date(2026, 9, 16))
    expect(screen.getByRole('heading', { name: 'Próximo acto · hoy' })).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getByText('oct')).toBeInTheDocument()
    expect(screen.getByText('19:00')).toBeInTheDocument()
    expect(screen.getByText('Viernes')).toBeInTheDocument()
    expect(screen.getByText('Solemne triduo')).toBeInTheDocument()
    expect(screen.getByText('Parroquia de los Padres Pasionistas')).toBeInTheDocument()
  })

  it('dice cuánto falta y no inventa hora ni lugar si no los tiene', () => {
    montar({ ...TRIDUO, hora: null, lugar: null }, new Date(2026, 9, 11))
    expect(screen.getByRole('heading', { name: 'Próximo acto · en 5 días' })).toBeInTheDocument()
    expect(screen.getByText('Viernes')).toBeInTheDocument()
    expect(screen.queryByText(/\d\d:\d\d/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Parroquia/)).not.toBeInTheDocument()
  })

  it('sin nada por delante, lo dice', () => {
    montar(undefined, new Date(2027, 2, 19))
    expect(screen.getByText('No queda nada en la Agenda hasta la estación de penitencia.')).toBeInTheDocument()
  })
})
