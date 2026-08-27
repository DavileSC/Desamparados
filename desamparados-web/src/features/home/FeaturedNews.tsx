import { Alert, Box, CircularProgress } from '@mui/material'
import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer'
import SectionTitle from '../../components/SectionTitle'
import NewsCard from '../../components/NewsCard'
import AnimatedSection from '../../components/AnimatedSection'
import { getLatestNews } from '../../lib/api/news'
import type { NewsItem } from '../../types'

export default function FeaturedNews() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLatestNews(4).then(setNews).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se ha podido cargar la actualidad.')).finally(() => setLoading(false))
  }, [])

  const [featured, ...rest] = news

  return (
    <AnimatedSection id="actualidad" sx={{ py: { xs: 8, md: 12 } }}>
      <PageContainer>
        <SectionTitle title="Actualidad" actionLabel="Ver todas" actionHref="/actualidad/noticias" />
        {loading && <CircularProgress aria-label="Cargando actualidad" />}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && news.length === 0 && <Alert severity="info">No hay noticias publicadas.</Alert>}

        {featured && <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '6fr 6fr' },
            gap: 3,
            mb: 3,
          }}
        >
          <NewsCard news={featured} featured />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
            {rest.slice(0, 2).map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </Box>
        </Box>}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 3,
          }}
        >
          {rest.slice(2).map((item) => (
            <NewsCard key={item.id} news={item} />
          ))}
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
