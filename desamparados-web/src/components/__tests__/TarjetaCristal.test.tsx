import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import TarjetaCristal from '../TarjetaCristal'

describe('TarjetaCristal', () => {
  it('renders children', () => {
    renderWithProviders(<TarjetaCristal>Card content</TarjetaCristal>)
    expect(screen.getByText(/card content/i)).toBeInTheDocument()
  })
})
