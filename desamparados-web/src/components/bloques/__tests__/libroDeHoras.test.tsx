import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import type { Bloque } from '../../../lib/api/contenido'

/**
 * Las piezas que llegaron con Pasionistas (27-11-2026): el bloque de notas al
 * margen, las tarjetas en índice, la cita en lámina y la foto entre filetes.
 */
const FOTO = '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp'

describe('el libro de horas de Pasionistas', () => {
  it('las notas al margen van aparte del texto, cada una con su dato', () => {
    const bloque: Bloque = {
      tipo: 'notasAlMargen', titulo: '', html: '<p>Llegaron a Málaga en 1972.</p>',
      notas: [{ dato: '1972', texto: 'Llegan a Málaga.' }, { dato: 'C.P.', texto: '' }],
      presentacion: { columnas: '2', alineacion: 'justificado', capitular: true },
    }
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    expect(screen.getByText('Llegaron a Málaga en 1972.')).toBeInTheDocument()
    const notas = screen.getByRole('complementary', { name: 'Notas al margen' })
    expect(within(notas).getByText('1972')).toBeInTheDocument()
    expect(within(notas).getByText('Llegan a Málaga.')).toBeInTheDocument()
    expect(within(notas).getByText('C.P.')).toBeInTheDocument()
  })

  it('las tarjetas en índice son una lista ordenada, sin el número escrito', () => {
    const bloque: Bloque = {
      tipo: 'tarjetas', titulo: 'Sus obras', presentacion: { estilo: 'indice' },
      tarjetas: [{ titulo: 'Cáritas parroquial', descripcion: 'Acogida', enlace: '' }, { titulo: 'Capellanías', descripcion: '', enlace: '' }],
    }
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    const lista = screen.getByRole('list')
    expect(lista.tagName).toBe('OL')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText(/^I\.$/)).not.toBeInTheDocument()
  })

  it('la cita en lámina lleva su foto con descripción; con otro estilo, la foto no sale', () => {
    const cita: Bloque = {
      tipo: 'cita', titulo: '', texto: 'La Pasión de Jesús es la obra más grande del amor de Dios.', autor: 'San Pablo de la Cruz', fuente: '',
      foto: FOTO, fotoAlt: 'La Virgen en su altar', pie: 'En Santa María Goretti.', presentacion: { estilo: 'lamina' },
    }
    const { unmount } = renderWithProviders(<BloquesDePagina bloques={[cita]} />)
    expect(screen.getByRole('img', { name: 'La Virgen en su altar' })).toBeInTheDocument()
    expect(screen.getByText('En Santa María Goretti.')).toBeInTheDocument()
    expect(screen.getByText('San Pablo de la Cruz')).toBeInTheDocument()
    unmount()

    renderWithProviders(<BloquesDePagina bloques={[{ ...cita, presentacion: { estilo: 'clasica' } }]} />)
    expect(screen.queryByRole('img', { name: 'La Virgen en su altar' })).not.toBeInTheDocument()
  })

  it('la foto entre filetes se pinta con su descripción', () => {
    const bloque: Bloque = { tipo: 'foto', titulo: '', url: FOTO, alt: 'El escudo pasionista', pie: '', presentacion: { marco: 'entreFiletes' } }
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    expect(screen.getByRole('img', { name: 'El escudo pasionista' })).toBeInTheDocument()
  })
})
