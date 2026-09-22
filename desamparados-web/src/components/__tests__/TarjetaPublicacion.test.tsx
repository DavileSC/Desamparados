import { describe, it, expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import TarjetaPublicacion from '../TarjetaPublicacion'

const publicacion = {
  id: '1', titulo: 'Boletín n.º 12', descripcion: 'Crónica del curso.', imagen: '/storage/public/ya-no-esta.jpg',
  fecha: '2026-08-21T12:00:00', categoria: 'boletin' as const, archivoUrl: '/storage/public/boletin.pdf',
}

describe('TarjetaPublicacion', () => {
  it('si la portada no carga, la quita en vez de enseñar una imagen rota', () => {
    renderWithProviders(<TarjetaPublicacion publicacion={publicacion} />)
    const portada = screen.getByRole('img', { name: 'Boletín n.º 12' })
    fireEvent.error(portada)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Crónica del curso.')).toBeInTheDocument()
  })
})
