import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import NoEncontradaPage from '../NoEncontradaPage'

afterEach(() => vi.unstubAllGlobals())

describe('la página de no encontrada', () => {
  it('dice qué dirección no existe, con la cita y los caminos de vuelta', async () => {
    // Sin recorrido guardado: la página tiene que valer igual, con el texto solo.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }))))
    renderWithProviders(<NoEncontradaPage />, { ruta: '/esta-no-existe', modulos: ['agenda'] })
    expect(screen.getByRole('heading', { level: 1, name: 'Esta calle no está en el recorrido' })).toBeInTheDocument()
    expect(screen.getByText('/esta-no-existe')).toBeInTheDocument()
    expect(screen.getByText('«Yo soy el camino y la verdad y la vida».')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la portada' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Ver la agenda' })).toHaveAttribute('href', '/agenda')
    expect(screen.getByRole('link', { name: /Contacto/ })).toHaveAttribute('href', '/contacto')
    // jsdom no pinta mapas: no se intenta.
    expect(screen.queryByRole('img', { name: /Mapa del recorrido/ })).not.toBeInTheDocument()
  })

  it('sin la Agenda, no lleva a ella', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }))))
    renderWithProviders(<NoEncontradaPage />, { ruta: '/x', modulos: [] })
    expect(screen.queryByRole('link', { name: 'Ver la agenda' })).not.toBeInTheDocument()
  })
})
