import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import AllTheProviders from './AllTheProviders'

export function renderWithProviders(
  ui: ReactElement,
  { ruta = '/', ...options }: Omit<RenderOptions, 'wrapper'> & { ruta?: string } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders ruta={ruta}>{children}</AllTheProviders>,
    ...options,
  })
}
