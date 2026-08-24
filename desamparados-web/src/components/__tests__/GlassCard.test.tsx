import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import GlassCard from '../GlassCard'

describe('GlassCard', () => {
  it('renders children', () => {
    renderWithProviders(<GlassCard>Card content</GlassCard>)
    expect(screen.getByText(/card content/i)).toBeInTheDocument()
  })
})
