import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloqueItinerario from '../BloqueItinerario'
import type { BloqueItinerario as Datos } from '../../../lib/api/contenido'

const bloque = (disposicion: string): Datos => ({
  tipo: 'itinerario',
  titulo: '',
  paradas: [
    { hora: '19:30', lugar: 'Salida desde el Templo' },
    { hora: '', lugar: 'C. Villalón' },
    { hora: '21:30', lugar: 'Regreso al Templo' },
  ],
  presentacion: { disposicion },
})

describe('BloqueItinerario, índice de devocionario', () => {
  it('pone cada calle con su hora, en el orden del camino', () => {
    renderWithProviders(<BloqueItinerario bloque={bloque('indice')} />)
    const filas = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(filas.map((fila) => fila.textContent)).toEqual([
      'Salida desde el Templo19:30',
      'C. VillalónPor confirmar',
      'Regreso al Templo21:30',
    ])
  })
})
