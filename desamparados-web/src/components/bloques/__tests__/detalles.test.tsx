import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import type { Bloque } from '../../../lib/api/contenido'

/** Las piezas que llegaron con Sagrada titular (27-11-2026). */
describe('el detalle a detalle', () => {
  const bloque: Bloque = {
    tipo: 'detalles', titulo: '',
    detalles: [
      { titulo: 'El rostro', texto: 'Tallado en cedro real.', foto: { url: '/images/cabeceras/rostro.webp', alt: 'El rostro de la Virgen' } },
      { titulo: 'La corona', texto: '', foto: { url: '/images/ajuar/corona.webp', alt: 'La corona de rayos y estrellas' } },
    ],
  }

  it('pinta cada detalle con su cuenta, su título de sección y su foto descrita', () => {
    renderWithProviders(<BloquesDePagina bloques={[bloque]} />)
    const detalles = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(detalles).toHaveLength(2)
    // Sin título del bloque, cada detalle es una sección de la página.
    expect(within(detalles[0]).getByRole('heading', { level: 2, name: 'El rostro' })).toBeInTheDocument()
    expect(detalles[0]).toHaveTextContent('Detalle 1 de 2')
    expect(within(detalles[1]).getByRole('img', { name: 'La corona de rayos y estrellas' })).toBeInTheDocument()
  })
})

describe('los datos en ficha', () => {
  it('llevan el título al lado y la aclaración bajo el valor', () => {
    const ficha: Bloque = {
      tipo: 'datos', titulo: 'La imagen', presentacion: { disposicion: 'ficha' },
      lineas: [
        { etiqueta: 'Autor', valor: 'Juan Vega Ortega', nota: 'Su primera imagen mariana para Málaga.' },
        { etiqueta: 'Material', valor: 'Cedro real' },
      ],
    }
    renderWithProviders(<BloquesDePagina bloques={[ficha]} />)
    // Un solo título: el de la ficha, no el de encima de todos los bloques.
    expect(screen.getAllByRole('heading', { name: 'La imagen' })).toHaveLength(1)
    const autor = screen.getByText('Autor').nextElementSibling as HTMLElement
    expect(autor).toHaveTextContent('Juan Vega Ortega')
    expect(autor).toHaveTextContent('Su primera imagen mariana para Málaga.')
  })
})
