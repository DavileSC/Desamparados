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

describe('BloqueItinerario con recorrido alternativo', () => {
  const conAlternativo = (enUso?: 'habitual' | 'alternativo'): Datos => ({
    ...bloque('indice'),
    alternativo: { paradas: [{ hora: '19:30', lugar: 'Salida desde el Templo' }, { hora: '20:15', lugar: 'Atajo por la plaza' }] },
    enUso,
  })

  it('enseña el habitual mientras no se ponga en uso el alternativo', () => {
    renderWithProviders(<BloqueItinerario bloque={conAlternativo()} />)
    expect(screen.getByText('C. Villalón')).toBeInTheDocument()
    expect(screen.queryByText('Atajo por la plaza')).not.toBeInTheDocument()
  })

  it('con el alternativo en uso, enseña sus paradas', () => {
    renderWithProviders(<BloqueItinerario bloque={conAlternativo('alternativo')} />)
    expect(screen.getByText('Atajo por la plaza')).toBeInTheDocument()
    expect(screen.queryByText('C. Villalón')).not.toBeInTheDocument()
  })
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

// El Rosario: solo se sabe que sale al acabar la misa, sin hora de cada calle.
describe('BloqueItinerario sin ninguna hora', () => {
  const sinHoras = (disposicion: string): Datos => ({
    ...bloque(disposicion),
    paradas: bloque(disposicion).paradas.map((parada) => ({ ...parada, hora: '' })),
  })

  it.each(['indice', 'linea', 'tarjetas'])('en «%s» va solo con las calles, sin «Por confirmar»', (disposicion) => {
    renderWithProviders(<BloqueItinerario bloque={sinHoras(disposicion)} />)
    expect(screen.queryByText('Por confirmar')).not.toBeInTheDocument()
    expect(screen.getByText('C. Villalón')).toBeInTheDocument()
  })

  it('en tabla no lleva la columna de la hora', () => {
    renderWithProviders(<BloqueItinerario bloque={sinHoras('tabla')} />)
    expect(screen.queryByRole('columnheader', { name: 'Hora' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('cell')).toHaveLength(3)
  })
})
