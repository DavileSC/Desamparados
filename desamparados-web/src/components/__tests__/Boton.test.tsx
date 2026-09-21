import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import Boton from '../Boton'

describe('Boton', () => {
  it('renders children correctly', () => {
    renderWithProviders(<Boton>Click me</Boton>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    renderWithProviders(<Boton disabled>Disabled</Boton>)
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled()
  })
})
