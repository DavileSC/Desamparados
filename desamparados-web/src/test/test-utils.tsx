import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import AllTheProviders from './AllTheProviders'
import type { NombresEnMenu } from '../lib/api/menu'

/**
 * `routerDeDatos`: para las pantallas que usan `useBlocker` (ver AllTheProviders).
 * `nombresEnMenu`: los que se pusieron en el CMS; sin él, ninguno (los de siempre).
 */
export function renderWithProviders(
  ui: ReactElement,
  { ruta = '/', modulos, nombresEnMenu, routerDeDatos, ...options }: Omit<RenderOptions, 'wrapper'> & { ruta?: string; modulos?: readonly string[]; nombresEnMenu?: NombresEnMenu; routerDeDatos?: boolean } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders ruta={ruta} modulos={modulos} nombresEnMenu={nombresEnMenu} routerDeDatos={routerDeDatos}>{children}</AllTheProviders>,
    ...options,
  })
}
