import { Helmet } from 'react-helmet-async'
import { useEffect, useState } from 'react'
import { Alert, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import EventCard from '../../../components/EventCard'
import AnimatedSection from '../../../components/AnimatedSection'
import { getPublicEvents } from '../../../lib/api/events'
import type { EventItem } from '../../../types'

export default function AgendaPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getPublicEvents()
      .then((data) => {
        if (!cancelled) setEvents(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se ha podido cargar la agenda.')
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
        <title>Agenda | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Agenda"
        subtitle="Calendario de cultos, actos y celebraciones de la Hermandad."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
          <PageContainer>
          <SectionTitle title="Próximos cultos y eventos" />
          {loading && <CircularProgress aria-label="Cargando agenda" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && events.length === 0 && (
            <Alert severity="info">No hay próximos eventos publicados.</Alert>
          )}
          {!loading && !error && events.length > 0 && <Grid container spacing={4}>
            {events.map((event) => (
              <Grid key={event.id} size={{ xs: 12, md: 6 }}>
                <EventCard event={event} />
              </Grid>
            ))}
          </Grid>}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
