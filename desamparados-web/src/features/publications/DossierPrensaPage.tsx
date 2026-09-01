import { Helmet } from 'react-helmet-async'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import Paginador from '../../components/Paginador'
import { usePublicacionesPaginadas } from './usePublicacionesPaginadas'

export default function DossierPrensaPage() {
  const { items: dossieres, meta, loading, error, alCambiarPagina, cambiarTamano } =
    usePublicacionesPaginadas('dossier', 'No se han podido cargar los dossieres.')

  return (
    <>
      <Helmet>
        <title>Dossier de Prensa | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Dossier de Prensa"
        subtitle="Recopilación de apariciones mediáticas."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Apariciones mediáticas" />
          {loading && <CircularProgress aria-label="Cargando dossieres" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && dossieres.length === 0 && <Alert severity="info">No hay dossieres disponibles.</Alert>}
          <Grid container spacing={3}>
            {dossieres.map((publication) => (
              <Grid key={publication.id} size={{ xs: 12, sm: 6, lg: 3 }}>
                <PublicationCard publication={publication} />
              </Grid>
            ))}
          </Grid>
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paginador meta={meta} onPagina={alCambiarPagina} onTamano={cambiarTamano} etiqueta="dossieres de prensa" />
            </Box>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
