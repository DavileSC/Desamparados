import { Helmet } from 'react-helmet-async'
import { Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import EventCard from '../../../components/EventCard'
import AnimatedSection from '../../../components/AnimatedSection'
import { eventItems } from '../../../lib/mocks/events'

export default function AgendaPage() {
  return (
    <>
      <Helmet>
        <title>Agenda | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Agenda"
        subtitle="Calendario de cultos, actos y celebraciones de la Hermandad."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Próximos cultos y eventos" />
          <Grid container spacing={4}>
            {eventItems.map((event) => (
              <Grid key={event.id} size={{ xs: 12, md: 6 }}>
                <EventCard event={event} />
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
