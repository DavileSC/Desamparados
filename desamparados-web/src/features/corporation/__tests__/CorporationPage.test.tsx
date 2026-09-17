import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import CorporationPage from '../CorporationPage'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

/**
 * Lo que esta página decía ANTES de convertirla, copiado a mano del .tsx
 * original. Si la migración se come un párrafo, este test lo caza.
 */
const ANTES = [
  'El Grupo Parroquial de Nuestra Señora de los Desamparados',
  'Como Grupo Parroquial, desarrollamos una intensa labor espiritual',
  'A continuación puedes conocer más sobre nuestra historia',
  'Explora la sección',
  'Historia', 'Parroquia', 'Nuestros fines', 'Cultos', 'Sábado de Pasión',
]

afterEach(() => { vi.unstubAllGlobals() })

function responder(datos: unknown = POR_DEFECTO.corporacion) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))))
}

describe('CorporationPage', () => {
  it('sigue diciendo lo mismo que antes de convertirla a bloques', async () => {
    responder()
    renderWithProviders(<CorporationPage />)

    await screen.findByText(/El Grupo Parroquial de Nuestra Señora/)
    const visible = document.body.textContent ?? ''
    for (const fragmento of ANTES) {
      expect(visible, `se ha perdido: «${fragmento}»`).toContain(fragmento)
    }
  })

  it('los enlaces de las tarjetas llevan a donde llevaban', async () => {
    responder()
    renderWithProviders(<CorporationPage />)

    expect(await screen.findByRole('link', { name: /Historia/ })).toHaveAttribute('href', '/corporacion/historia')
    expect(screen.getByRole('link', { name: /Sábado de Pasión/ })).toHaveAttribute('href', '/corporacion/sabado-de-pasion')
  })

  it('si el servidor no responde, la página no se queda en blanco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    renderWithProviders(<CorporationPage />)

    // La cabecera es lo mínimo que tiene que quedar en pie.
    expect(await screen.findByRole('heading', { name: 'Corporación' })).toBeInTheDocument()
  })
})
