import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import type { Bloque } from '../../../lib/api/contenido'

/** Las piezas que llegaron con Evangelización (27-11-2026). */
describe('las preguntas numeradas', () => {
  const bloque: Bloque = {
    tipo: 'preguntas', titulo: 'Lo que nos preguntan', presentacion: { estilo: 'numeradas', abrirPrimera: true },
    preguntas: [
      { pregunta: '¿Por qué rezamos un triduo?', respuesta: 'Tres días de oración.' },
      { pregunta: '¿Qué significa el besamanos?', respuesta: 'Se venera a quien representa.' },
    ],
  }

  it('abren la primera y la segunda al pulsarla, sin cerrar la primera', async () => {
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    const primera = screen.getByRole('button', { name: '¿Por qué rezamos un triduo?' })
    const segunda = screen.getByRole('button', { name: '¿Qué significa el besamanos?' })
    expect(primera).toHaveAttribute('aria-expanded', 'true')
    expect(segunda).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(segunda)
    expect(segunda).toHaveAttribute('aria-expanded', 'true')
    expect(primera).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('la cita en retrato', () => {
  it('lleva su foto en color al lado y la firma', () => {
    const cita: Bloque = {
      tipo: 'cita', titulo: '', presentacion: { estilo: 'retrato' },
      texto: 'María conservaba todas estas cosas.', autor: '', fuente: 'Lucas 2, 19',
      foto: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', fotoAlt: 'La Virgen de perfil', pie: '',
    }
    renderWithProviders(<BloquesDePagina bloques={[cita]} />)
    expect(screen.getByRole('img', { name: 'La Virgen de perfil' })).toBeInTheDocument()
    expect(screen.getByText('Lucas 2, 19')).toBeInTheDocument()
  })
})
