import { Helmet } from 'react-helmet-async'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import EventCard from '../../../components/EventCard'
import AnimatedSection from '../../../components/AnimatedSection'
import Paginador from '../../../components/Paginador'
import { getPublicEvents } from '../../../lib/api/events'
import { useListadoPaginado, type Pagina } from '../../../hooks/useListadoPaginado'

// Fuera del componente para que no cambie de identidad en cada render: el hook
// la lleva en las dependencias de su efecto. El listado habla en `data`; la
// agenda devuelve `eventos` porque el CMS necesita el evento crudo.
const pedirAgenda = (pagina: Pagina) =>
  getPublicEvents(pagina).then(({ eventos, meta }) => ({ data: eventos, meta }))

export default function AgendaPage() {
  const { items: events, meta, loading, error, alCambiarPagina, cambiarTamano } =
    useListadoPaginado(pedirAgenda, 'No se ha podido cargar la agenda.')

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
