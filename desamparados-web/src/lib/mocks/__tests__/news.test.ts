import { describe, it, expect } from 'vitest'
import { newsItems, getLatestNews, getNewsBySlug } from '../news'

describe('news mocks', () => {
  it('returns all news items', () => {
    expect(newsItems.length).toBeGreaterThan(0)
  })

  it('returns latest news limited by count', () => {
    const latest = getLatestNews(2)
    expect(latest.length).toBe(2)
  })

  it('finds news by slug', () => {
    const news = getNewsBySlug(newsItems[0].slug)
    expect(news).toBeDefined()
    expect(news?.slug).toBe(newsItems[0].slug)
  })

  it('returns undefined for unknown slug', () => {
    const news = getNewsBySlug('unknown-slug')
    expect(news).toBeUndefined()
  })
})
