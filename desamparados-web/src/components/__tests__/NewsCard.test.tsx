import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import NewsCard from '../NewsCard'
import type { NewsItem } from '../../types'

const mockNews: NewsItem = {
  id: '1',
  title: 'Solemne triduo',
  excerpt: 'Tres jornadas de oración',
  category: 'Noticias',
  date: '2026-08-29T10:00:00.000Z',
  slug: 'solemne-triduo',
}

describe('NewsCard', () => {
  it('es un enlace a la ficha con fecha, título y extracto', () => {
    renderWithProviders(<NewsCard news={mockNews} />)
    const tarjeta = screen.getByRole('link', { name: /solemne triduo/i })
    expect(tarjeta).toHaveAttribute('href', '/actualidad/noticias/solemne-triduo')
    expect(within(tarjeta).getByRole('heading', { level: 3 })).toHaveTextContent('Solemne triduo')
    expect(within(tarjeta).getByText('Tres jornadas de oración')).toBeInTheDocument()
    expect(tarjeta.querySelector('time')).toHaveAttribute('datetime', mockNews.date)
  })

  it('no repite la categoría: en el archivo todas son noticias', () => {
    // Se rompe si vuelve la etiqueta «NOTICIAS» en cada tarjeta.
    renderWithProviders(<NewsCard news={mockNews} />)
    expect(screen.queryByText(/^noticias$/i)).not.toBeInTheDocument()
  })

  it('sin foto pone una placa con la inicial, y con foto la usa', () => {
    const { unmount } = renderWithProviders(<NewsCard news={mockNews} />)
    expect(screen.getByTestId('placa-noticia')).toHaveTextContent('S')
    unmount()

    renderWithProviders(<NewsCard news={{ ...mockNews, image: '/storage/triduo.jpg' }} />)
    expect(screen.getByRole('link').querySelector('img')).toHaveAttribute('src', '/storage/triduo.jpg')
    expect(screen.queryByTestId('placa-noticia')).not.toBeInTheDocument()
  })

  it('marca la destacada para que el listado le dé todo el ancho', () => {
    renderWithProviders(<NewsCard news={mockNews} destacada />)
    expect(screen.getByRole('link')).toHaveAttribute('data-destacada', 'true')
  })
})
