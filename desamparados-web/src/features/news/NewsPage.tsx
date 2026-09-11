import { Helmet } from 'react-helmet-async'
import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import NewsCard from '../../components/NewsCard'
import EventCard from '../../components/EventCard'
import AnimatedSection from '../../components/AnimatedSection'
import AppButton from '../../components/AppButton'
import { getLatestNews } from '../../lib/api/news'
import { getProximosEventos } from '../../lib/api/events'
import type { EventItem, NewsItem } from '../../types'

export default function NewsPage() {
  const [latestNews, setLatestNews] = useState<NewsItem[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Tres noticias: las tarjetas van de tres en tres, como en la portada y el archivo.
    Promise.all([getLatestNews(3), getProximosEventos(4)])
      .then(([news, events]) => {
        if (!cancelled) {
          setLatestNews(news)
          setUpcomingEvents(events)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se ha podido cargar la actualidad.')
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
        <title>Actualidad | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Actualidad"
        subtitle="Toda la información de nuestra corporación: noticias, cultos y eventos."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle
            title="Últimas noticias"
            actionLabel="Ver todas las noticias"
            actionHref="/actualidad/noticias"
          />
            {loading && <CircularProgress aria-label="Cargando actualidad" />}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && latestNews.length === 0 && <Alert severity="info">No hay noticias publicadas.</Alert>}
            {!loading && !error && latestNews.length > 0 && (
              <Box
                component="ul"
                aria-label="Últimas noticias"
                sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 3, md: 3.25 } }}
              >
                {latestNews.map((news, i) => (
                  <Box component="li" key={news.id} sx={{ display: 'flex' }}>
                    <NewsCard news={news} indice={i} />
                  </Box>
                ))}
              </Box>
            )}
        </PageContainer>
      </AnimatedSection>

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle
            title="Próximos cultos y eventos"
            actionLabel="Ver agenda completa"
            actionHref="/actualidad/agenda"
          />
          {!loading && !error && upcomingEvents.length === 0 && <Alert severity="info">No hay próximos eventos.</Alert>}
          {!loading && !error && upcomingEvents.length > 0 && <Grid container spacing={4}>
            {upcomingEvents.map((event) => (
              <Grid key={event.id} size={{ xs: 12, md: 6 }}>
                <EventCard event={event} />
              </Grid>
            ))}
          </Grid>}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 6, flexWrap: 'wrap' }}>
            <AppButton appVariant="primary" href="/actualidad/noticias">
              Ver todas las noticias
            </AppButton>
            <AppButton appVariant="outline" href="/actualidad/agenda">
              Ver agenda completa
            </AppButton>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
