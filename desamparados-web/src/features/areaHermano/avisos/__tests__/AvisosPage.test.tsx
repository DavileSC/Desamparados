import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import AvisosPage from '../AvisosPage'

const respuesta = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

describe('AvisosPage', () => {
  it('lista lo pendiente con la papeleta, y cada aviso lleva a su página', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta([
      { id: 12, asunto: 'Mañana, recogida de la papeleta', extracto: 'Le recordamos que mañana tiene cita.', enviadoEl: '2026-10-15T08:00:00.000Z' },
      { id: 9, asunto: 'Su papeleta sigue sin recoger', extracto: 'Aún puede recogerla.', enviadoEl: '2026-10-14T10:00:00.000Z' },
    ])))
    renderWithProviders(<AvisosPage />)

    expect(await screen.findByRole('link', { name: /recogida de la papeleta/ })).toHaveAttribute('href', '/area-hermano/avisos/personal/12')
    expect(screen.getByRole('link', { name: /sin recoger/ })).toHaveAttribute('href', '/area-hermano/avisos/personal/9')
    expect(screen.getByText('14 de octubre de 2026')).toBeInTheDocument()
  })

  it('sin avisos, lo dice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta([])))
    renderWithProviders(<AvisosPage />)
    expect(await screen.findByText('Todavía no has recibido ningún aviso.')).toBeInTheDocument()
  })
})
