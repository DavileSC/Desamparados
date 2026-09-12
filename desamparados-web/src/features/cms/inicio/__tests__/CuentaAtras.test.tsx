import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import CuentaAtras from '../CuentaAtras'

const montar = (hoy: Date) =>
  renderWithProviders(<TemaCmsProvider><CuentaAtras hoy={hoy} /></TemaCmsProvider>)

describe('CuentaAtras', () => {
  it('dice cuántos días faltan y para qué fecha', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('190')).toBeInTheDocument()
    // La fecha sale dos veces (antetítulo y extremo de la barra): se ancla en el
    // antetítulo, que es el que la nombra.
    expect(screen.getByText(/Sábado de Pasión · 20 mar 2027/)).toBeInTheDocument()
  })

  it('enseña qué parte del curso ha pasado', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('47 % del curso')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '47')
  })

  it('el mismo día de la estación no cuenta días de más', () => {
    montar(new Date(2026, 2, 28))
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
