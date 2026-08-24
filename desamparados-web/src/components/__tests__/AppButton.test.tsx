import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import AppButton from '../AppButton'

describe('AppButton', () => {
  it('renders children correctly', () => {
    renderWithProviders(<AppButton>Click me</AppButton>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    renderWithProviders(<AppButton disabled>Disabled</AppButton>)
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled()
  })
})
