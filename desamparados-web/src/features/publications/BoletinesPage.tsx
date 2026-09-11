import { Helmet } from 'react-helmet-async'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import Paginador from '../../components/Paginador'
import { usePublicacionesPaginadas } from './usePublicacionesPaginadas'

export default function BoletinesPage() {
  const { items: boletines, meta, loading, error, alCambiarPagina } =
    usePublicacionesPaginadas('boletin', 'No se han podido cargar los boletines.')

  return (
    <>
      <Helmet>
        <title>Boletines | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Boletines"
        subtitle="Revista anual del Grupo Parroquial."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Boletines anuales" />
          {loading && <CircularProgress aria-label="Cargando boletines" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && boletines.length === 0 && <Alert severity="info">No hay boletines disponibles.</Alert>}
          <Grid container spacing={3}>
            {boletines.map((publication) => (
              <Grid key={publication.id} size={{ xs: 12, sm: 6, lg: 3 }}>
                <PublicationCard publication={publication} />
              </Grid>
            ))}
          </Grid>
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paginador meta={meta} onPagina={alCambiarPagina} etiqueta="boletines" />
            </Box>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
