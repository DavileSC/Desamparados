import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import AllTheProviders from './AllTheProviders'

export function renderWithProviders(
  ui: ReactElement,
  { ruta = '/', modulos, ...options }: Omit<RenderOptions, 'wrapper'> & { ruta?: string; modulos?: readonly string[] } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders ruta={ruta} modulos={modulos}>{children}</AllTheProviders>,
    ...options,
  })
}
