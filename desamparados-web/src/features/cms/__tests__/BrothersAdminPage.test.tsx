import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BrothersAdminPage from '../BrothersAdminPage'
import { useAuthStore } from '../../members/auth/store'

type Censo = { data: unknown[]; meta: { total: number; page: number; limit: number; totalPages: number } }

/** El censo y las solicitudes son dos llamadas distintas: responde por URL. */
function responderCenso(censo: Censo, solicitudes: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const cuerpo = String(url).includes('solicitudes') ? solicitudes : censo
    return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))
}

const censoVacio: Censo = { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }

beforeEach(() => {
  useAuthStore.setState({ status: 'autenticado', user: { id: 1, email: 'secre@ejemplo.es', role: 'SECRETARIA', perfiles: [] } })
  // La vista vive en la URL y el `BrowserRouter` de los tests comparte el
  // `window.location`: sin esto, un test empieza donde lo dejó el anterior.
  window.history.replaceState({}, '', '/cms/hermanos')
})

afterEach(() => { vi.unstubAllGlobals() })

describe('BrothersAdminPage', () => {
  it('la pestaña de solicitudes se ve aunque no haya ninguna', async () => {
    // Antes el bloque entero desaparecía sin solicitudes: la función existía y
    // era invisible, así que nadie sabía que estaba.
    responderCenso(censoVacio, [])
    renderWithProviders(<BrothersAdminPage />)
    fireEvent.click(await screen.findByRole('tab', { name: /solicitudes/i }))
    expect(screen.getByText(/no hay solicitudes pendientes/i)).toBeInTheDocument()
  })

  it('la pestaña lleva el número de pendientes', async () => {
    responderCenso(censoVacio, [
      { id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] },
      { id: 2, email: 'otra@ejemplo.invalido', nombre: 'Otra', apellidos: 'Solicitante', createdAt: '2026-08-02T00:00:00.000Z', hermanos: [{ id: 10 }] },
    ])
    renderWithProviders(<BrothersAdminPage />)
    expect(await screen.findByRole('tab', { name: /solicitudes \(2\)/i })).toBeInTheDocument()
  })

  it('el censo no se mezcla con las solicitudes', async () => {
    responderCenso(censoVacio, [
      { id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', createdAt: '2026-08-01T00:00:00.000Z', hermanos: [{ id: 9 }] },
    ])
    renderWithProviders(<BrothersAdminPage />)
    // En la pestaña del censo está el buscador y no las solicitudes.
    expect(await screen.findByLabelText(/buscar por nombre/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /solicitudes/i }))
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/buscar por nombre/i)).not.toBeInTheDocument()
  })
})
