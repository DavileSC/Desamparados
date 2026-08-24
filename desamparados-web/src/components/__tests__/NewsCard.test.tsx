import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import NewsCard from '../NewsCard'
import type { NewsItem } from '../../types'

const mockNews: NewsItem = {
  id: '1',
  title: 'Test News',
  excerpt: 'This is a test news excerpt',
  category: 'Cultos',
  date: '2024-01-01',
  slug: 'test-news',
}

describe('NewsCard', () => {
  it('renders news title and excerpt', () => {
    renderWithProviders(<NewsCard news={mockNews} />)
    expect(screen.getByRole('heading', { name: /test news/i })).toBeInTheDocument()
    expect(screen.getByText(/this is a test news excerpt/i)).toBeInTheDocument()
  })

  it('renders category label', () => {
    renderWithProviders(<NewsCard news={mockNews} />)
    expect(screen.getByText(/cultos/i)).toBeInTheDocument()
  })
})
