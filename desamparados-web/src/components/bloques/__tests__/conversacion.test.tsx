import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import type { Bloque } from '../../../lib/api/contenido'

/** Las piezas que llegaron con Grupo Joven (27-11-2026). */
describe('la conversación', () => {
  const bloque: Bloque = {
    tipo: 'conversacion', titulo: 'Lo que nos preguntan', nombre: 'Grupo Joven',
    turnos: [
      { pregunta: '¿Y qué se hace?', respuesta: 'Un poco de todo:', etiquetas: ['Montar el altar', 'Excursiones'], boton: '', enlace: '' },
      { pregunta: '¿Cómo empiezo?', respuesta: 'Escríbenos.', etiquetas: [], boton: 'Escríbenos', enlace: '/contacto' },
    ],
  }

  it('pinta cada turno con su pregunta, quién contesta, las etiquetas y el botón', () => {
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    // La primera lista es la de los turnos; las etiquetas van en otra, dentro.
    const turnos = [...screen.getAllByRole('list')[0].children] as HTMLElement[]
    expect(turnos).toHaveLength(2)
    expect(within(turnos[0]).getByText('¿Y qué se hace?')).toBeInTheDocument()
    expect(within(turnos[0]).getByText('Grupo Joven')).toBeInTheDocument()
    expect(within(turnos[0]).getByText('Montar el altar')).toBeInTheDocument()
    expect(within(turnos[1]).getByRole('link', { name: 'Escríbenos' })).toHaveAttribute('href', '/contacto')
  })
})

describe('las tarjetas en historias', () => {
  it('van en una tira que se recorre con el teclado, con su etiqueta y su título', () => {
    const bloque: Bloque = {
      tipo: 'tarjetas', titulo: 'Así es un año', presentacion: { estilo: 'historias' },
      tarjetas: [
        { titulo: 'Rosario por el barrio', descripcion: '', enlace: '', etiqueta: 'Octubre' },
        { titulo: 'Preparar la cera', descripcion: '', enlace: '', etiqueta: 'Antes de cada culto' },
      ],
    }
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    const tira = screen.getByRole('list', { name: 'Así es un año' })
    expect(tira).toHaveAttribute('tabindex', '0')
    expect(within(tira).getAllByRole('listitem')).toHaveLength(2)
    expect(within(tira).getByRole('heading', { name: 'Rosario por el barrio' })).toBeInTheDocument()
    expect(within(tira).getByText('Octubre')).toBeInTheDocument()
  })
})
