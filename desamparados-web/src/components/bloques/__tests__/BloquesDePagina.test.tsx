import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import { REGISTRO_BLOQUES } from '../registro'
import TIPOS from '../../../../../shared/tipos-de-bloque.json'
import type { Bloque } from '../../../lib/api/contenido'

const TEXTO: Bloque = { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' }
const FOTO: Bloque = { tipo: 'foto', titulo: '', url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', alt: 'La Virgen', pie: 'Camarín' }
const TARJETAS: Bloque = {
  tipo: 'tarjetas', titulo: 'Explora la sección',
  tarjetas: [{ titulo: 'Historia', descripcion: 'Orígenes.', enlace: '/corporacion/historia' }],
}

describe('BloquesDePagina', () => {
  it('el registro cubre todos los tipos del catálogo compartido', () => {
    // Si alguien añade un tipo en shared/ y olvida su componente, la página
    // dejaría un hueco en blanco sin que nada fallara.
    for (const tipo of TIPOS.tipos) {
      expect(REGISTRO_BLOQUES[tipo as keyof typeof REGISTRO_BLOQUES], `falta el componente de «${tipo}»`).toBeDefined()
    }
  })

  it('pinta los bloques en el orden en que vienen', () => {
    renderWithProviders(<BloquesDePagina bloques={[TARJETAS, TEXTO]} />)
    const textos = screen.getAllByText(/Explora la sección|Un párrafo/)
    expect(textos[0].textContent).toContain('Explora la sección')
  })

  it('el bloque de texto pinta el HTML maquetado, no como etiquetas', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[TEXTO]} />)
    expect(container.querySelector('p')?.textContent).toBe('Un párrafo')
    expect(container.textContent).not.toContain('<p>')
  })

  it('la foto lleva su descripción y su pie', () => {
    renderWithProviders(<BloquesDePagina bloques={[FOTO]} />)
    expect(screen.getByAltText('La Virgen')).toBeInTheDocument()
    expect(screen.getByText('Camarín')).toBeInTheDocument()
  })

  it('las tarjetas enlazan donde dicen', () => {
    renderWithProviders(<BloquesDePagina bloques={[TARJETAS]} />)
    expect(screen.getByRole('link', { name: /Historia/ })).toHaveAttribute('href', '/corporacion/historia')
  })

  it('una página sin bloques no revienta', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('un tipo desconocido se salta sin tirar la página', () => {
    // El servidor ya lo rechaza al guardar; esto es la segunda red, para un
    // documento viejo en la base tras quitar un tipo del catálogo.
    const raro = { tipo: 'loQueSea', titulo: '' } as unknown as Bloque
    renderWithProviders(<BloquesDePagina bloques={[raro, TEXTO]} />)
    expect(screen.getByText('Un párrafo')).toBeInTheDocument()
  })
})
