import { describe, it, expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloqueFoto from '../BloqueFoto'
import BloqueFotoTexto from '../BloqueFotoTexto'
import BloqueTarjetas from '../BloqueTarjetas'
import CabeceraASangre from '../CabeceraASangre'

// Una foto de /images/ que falta en la instalación (o que nginx no puede leer)
// no deja el icono roto con el texto alternativo encima: se quita.
const FALTA = '/images/cabeceras/no-esta.webp'

describe('las fotos del contenido que no cargan', () => {
  it('el bloque Foto se quita entero', () => {
    renderWithProviders(<BloqueFoto bloque={{ tipo: 'foto', titulo: '', url: FALTA, alt: 'La imagen titular', pie: 'Un pie' }} />)
    fireEvent.error(screen.getByRole('img', { name: 'La imagen titular' }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('Un pie')).not.toBeInTheDocument()
  })

  it('en Foto y texto se queda el texto', () => {
    renderWithProviders(<BloqueFotoTexto bloque={{ tipo: 'fotoTexto', titulo: 'Nuestro templo', url: FALTA, alt: 'El templo', pie: '', html: '<p>Nuestro templo, desde 1950.</p>', boton: '', enlace: '' }} />)
    fireEvent.error(screen.getByRole('img', { name: 'El templo' }))
    expect(screen.queryByRole('img', { name: 'El templo' })).not.toBeInTheDocument()
    expect(screen.getByText('Nuestro templo, desde 1950.')).toBeInTheDocument()
  })

  it('una tarjeta se queda sin foto, con su título', () => {
    renderWithProviders(<BloqueTarjetas bloque={{ tipo: 'tarjetas', titulo: '', tarjetas: [{ titulo: 'Caridad', descripcion: 'Texto.', enlace: '', foto: FALTA, fotoAlt: 'Reparto' }] }} />)
    fireEvent.error(screen.getByRole('img', { name: 'Reparto' }))
    expect(screen.queryByRole('img', { name: 'Reparto' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Caridad' })).toBeInTheDocument()
  })

  it('la cabecera a sangre deja el fondo y el título', () => {
    renderWithProviders(<CabeceraASangre titulo="Historia" subtitulo="" foto={FALTA} fotoAlt="La procesión" ceja={[]} />)
    // Primero falla la copia reducida y se prueba la original; luego, la original.
    fireEvent.error(screen.getByRole('img', { name: 'La procesión' }))
    expect(screen.getByRole('img', { name: 'La procesión' })).not.toHaveAttribute('srcset')
    fireEvent.error(screen.getByRole('img', { name: 'La procesión' }))
    expect(screen.queryByRole('img', { name: 'La procesión' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Historia' })).toBeInTheDocument()
  })
})
