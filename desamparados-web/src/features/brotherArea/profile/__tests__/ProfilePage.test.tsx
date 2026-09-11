import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import ProfilePage from '../ProfilePage'
import { FICHAS_POR_FAMILIA } from '../../../../lib/api/profile'

function ficha(id: number, nombre: string, esTitular = true) {
  return {
    esTitular,
    id,
    nombre,
    apellidos: 'Pérez Ruiz',
    email: `${nombre.toLowerCase()}@ejemplo.test`,
    telefono: '600000000',
    direccion: 'Calle Mayor 1',
    poblacion: 'Málaga',
    codigoPostal: '29001',
    fechaAlta: '2020-03-01T00:00:00.000Z',
    numeroHermano: 42,
    activo: true,
  }
}

/**
 * Una instancia de `Response` por llamada: `apiFetch` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
function responder(data: unknown[], meta: Record<string, number>) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ProfilePage', () => {
  it('pinta la ficha que llega en data', async () => {
    responder([ficha(1, 'Ana')], { total: 1, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 })
    renderWithProviders(<ProfilePage />)

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument()
  })

  /**
   * Esta pantalla no lista fichas: elige una sobre la que operar. Si pidiera una
   * página corta, el tutor con más fichas que caben en ella dejaría de poder
   * llegar a alguna y aquí no hay paginador con el que ir a buscarla. Por eso
   * pide la familia entera de una vez, y esto lo deja fijado.
   */
  it('pide la familia entera, no una página corta', async () => {
    const simulado = responder(
      [ficha(1, 'Ana'), ficha(2, 'Bruno'), ficha(3, 'Carla')],
      { total: 3, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 },
    )
    renderWithProviders(<ProfilePage />)

    await waitFor(() => expect(simulado.mock.calls.length).toBeGreaterThan(0))
    const pedida = new URL(String(simulado.mock.calls[0]?.[0]), 'http://localhost')
    expect(pedida.pathname).toContain('/hermanos/mis-perfiles')
    expect(Number(pedida.searchParams.get('limit'))).toBe(FICHAS_POR_FAMILIA)
    expect(pedida.searchParams.get('page')).toBe('1')
  })

  // El servidor ordena por fecha de nacimiento descendente: la primera ficha es
  // la del hijo más pequeño, no la del tutor que ha iniciado sesión.
  it('enseña la ficha del titular aunque no sea la primera', async () => {
    responder(
      [ficha(2, 'Bruno', false), ficha(1, 'Ana', true)],
      { total: 2, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 },
    )
    renderWithProviders(<ProfilePage />)

    expect(await screen.findByText('Ana Pérez Ruiz')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Pérez Ruiz')).not.toBeInTheDocument()
  })

  it('sin ficha propia, enseña la primera de la familia', async () => {
    responder([ficha(2, 'Bruno', false)], { total: 1, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 1 })
    renderWithProviders(<ProfilePage />)

    expect(await screen.findByText('Bruno Pérez Ruiz')).toBeInTheDocument()
  })

  it('avisa cuando la cuenta no tiene ninguna ficha', async () => {
    responder([], { total: 0, page: 1, limit: FICHAS_POR_FAMILIA, totalPages: 0 })
    renderWithProviders(<ProfilePage />)

    expect(await screen.findByText(/no se ha encontrado ningún perfil/i)).toBeInTheDocument()
  })
})
