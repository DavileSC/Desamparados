import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import AllTheProviders from './AllTheProviders'

/** `routerDeDatos`: para las pantallas que usan `useBlocker` (ver AllTheProviders). */
export function renderWithProviders(
  ui: ReactElement,
  { ruta = '/', modulos, routerDeDatos, ...options }: Omit<RenderOptions, 'wrapper'> & { ruta?: string; modulos?: readonly string[]; routerDeDatos?: boolean } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders ruta={ruta} modulos={modulos} routerDeDatos={routerDeDatos}>{children}</AllTheProviders>,
    ...options,
  })
}
