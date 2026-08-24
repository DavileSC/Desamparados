import { Helmet } from 'react-helmet-async'
import { Box, Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import NewsCard from '../../components/NewsCard'
import EventCard from '../../components/EventCard'
import AnimatedSection from '../../components/AnimatedSection'
import AppButton from '../../components/AppButton'
import { getLatestNews } from '../../lib/mocks/news'
import { getUpcomingEvents } from '../../lib/mocks/events'

export default function NewsPage() {
  const latestNews = getLatestNews(4)
  const upcomingEvents = getUpcomingEvents(4)

  return (
    <>
      <Helmet>
        <title>Actualidad | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Actualidad"
        subtitle="Toda la información de nuestra corporación: noticias, cultos y eventos."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle
            title="Últimas noticias"
            actionLabel="Ver todas las noticias"
            actionHref="/actualidad/noticias"
          />
          <Grid container spacing={3}>
            {latestNews.map((news) => (
              <Grid key={news.id} size={{ xs: 12, md: 6, lg: 3 }}>
                <NewsCard news={news} />
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle
            title="Próximos cultos y eventos"
            actionLabel="Ver agenda completa"
            actionHref="/actualidad/agenda"
          />
          <Grid container spacing={4}>
            {upcomingEvents.map((event) => (
              <Grid key={event.id} size={{ xs: 12, md: 6 }}>
                <EventCard event={event} />
              </Grid>
            ))}
          </Grid>
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
