import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import AvisosPage from '../AvisosPage'

const respuesta = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

describe('AvisosPage', () => {
  it('lista los avisos recibidos, cada uno lleva a su página', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta([
      { id: 12, asunto: 'Reparto de túnicas', extracto: 'El sábado se reparten las túnicas.', enviadoEl: '2026-10-14T10:00:00.000Z' },
    ])))
    renderWithProviders(<AvisosPage />)

    const enlace = await screen.findByRole('link', { name: /Reparto de túnicas/ })
    expect(enlace).toHaveAttribute('href', '/area-hermano/avisos/12')
    expect(screen.getByText('14 de octubre de 2026')).toBeInTheDocument()
  })

  it('sin avisos, lo dice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta([])))
    renderWithProviders(<AvisosPage />)
    expect(await screen.findByText('Todavía no has recibido ningún aviso.')).toBeInTheDocument()
  })
})
