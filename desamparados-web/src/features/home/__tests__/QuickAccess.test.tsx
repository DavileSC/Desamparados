import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import QuickAccess from '../QuickAccess'

describe('QuickAccess', () => {
  it('ofrece seis accesos en una lista, cada uno a su página', () => {
    // Se rompe si un acceso apunta a otra ruta, si vuelve el acceso de hermanos
    // (ya está siempre visible en el menú), si vuelven la agenda o el recorrido
    // (tienen bloque propio en la portada) o si el bloque deja de ser una lista.
    renderWithProviders(<QuickAccess />)

    const lista = screen.getByRole('list', { name: /accesos directos/i })
    const destinos = within(lista).getAllByRole('link').map((enlace) => enlace.getAttribute('href'))

    expect(destinos).toEqual([
      '/hermanos/hazte-hermano',
      '/corporacion/parroquia-pasionistas',
      '/corporacion/nuestros-fines/caridad',
      '/corporacion/historia',
      '/publicaciones/boletines',
      '/contacto',
    ])
  })

  it('anuncia en cada enlace qué hay detrás, no solo su título', () => {
    // Se rompe si la descripción se saca del enlace: un lector de pantalla
    // volvería a oír solo «Boletines», sin contexto.
    renderWithProviders(<QuickAccess />)

    expect(
      screen.getByRole('link', { name: /boletines.*boletín informativo y anuarios/i }),
    ).toHaveAttribute('href', '/publicaciones/boletines')
  })
})
