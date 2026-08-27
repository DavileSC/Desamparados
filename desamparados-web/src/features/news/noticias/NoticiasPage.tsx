import { Helmet } from 'react-helmet-async'
import { useEffect, useState } from 'react'
import { Alert, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import NewsCard from '../../../components/NewsCard'
import AnimatedSection from '../../../components/AnimatedSection'
import { getNewsArchive } from '../../../lib/api/news'
import type { NewsItem } from '../../../types'

export default function NoticiasPage() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getNewsArchive()
      .then((data) => {
        if (!cancelled) setNewsItems(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se han podido cargar las noticias.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Helmet>
        <title>Noticias | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Noticias"
        subtitle="Últimas noticias de la Hermandad de los Desamparados."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Todas las noticias" />
          {loading && <CircularProgress aria-label="Cargando noticias" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && newsItems.length === 0 && <Alert severity="info">No hay noticias publicadas.</Alert>}
          {!loading && !error && newsItems.length > 0 && <Grid container spacing={3}>
            {newsItems.map((news) => (
              <Grid key={news.id} size={{ xs: 12, md: 6, lg: 3 }}>
                <NewsCard news={news} />
              </Grid>
            ))}
          </Grid>}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
