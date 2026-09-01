import { Helmet } from 'react-helmet-async'
import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import EventCard from '../../../components/EventCard'
import AnimatedSection from '../../../components/AnimatedSection'
import Paginador from '../../../components/Paginador'
import { getPublicEvents } from '../../../lib/api/events'
import { usePaginacion } from '../../../hooks/usePaginacion'
import type { MetaPaginacion } from '../../../lib/api/tipos'
import type { EventItem } from '../../../types'

export default function AgendaPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()

  useEffect(() => {
    let cancelled = false

    getPublicEvents({ pagina, porPagina })
      .then((respuesta) => {
        if (cancelled) return
        setEvents(respuesta.eventos)
        setMeta(respuesta.meta)
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
  }, [pagina, porPagina])

  const alCambiarPagina = (numero: number) => {
    irAPagina(numero)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <Helmet>
        <title>Agenda | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Agenda"
        subtitle="Calendario de cultos, actos y celebraciones del Grupo Parroquial."
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
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paginador meta={meta} onPagina={alCambiarPagina} onTamano={cambiarTamano} etiqueta="la agenda" />
            </Box>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
