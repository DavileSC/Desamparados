import { Helmet } from 'react-helmet-async'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import Paginador from '../../components/Paginador'
import { usePublicacionesPaginadas } from './usePublicacionesPaginadas'

export default function PublicationsPage() {
  const { items, meta, loading, error, alCambiarPagina } =
    usePublicacionesPaginadas(undefined, 'No se han podido cargar las publicaciones.')

  return (
    <>
      <Helmet>
        <title>Publicaciones | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Publicaciones"
        subtitle="Boletines, dossieres de prensa y documentos de nuestra historia."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Todas las publicaciones" />
          {loading && <CircularProgress aria-label="Cargando publicaciones" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && items.length === 0 && <Alert severity="info">No hay publicaciones disponibles.</Alert>}
          <Grid container spacing={3}>
            {items.map((publication) => (
              <Grid key={publication.id} size={{ xs: 12, sm: 6, lg: 3 }}>
                <PublicationCard publication={publication} />
              </Grid>
            ))}
          </Grid>
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paginador meta={meta} onPagina={alCambiarPagina} etiqueta="publicaciones" />
            </Box>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
