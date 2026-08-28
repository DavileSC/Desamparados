import { Helmet } from 'react-helmet-async'
import { Alert, CircularProgress, Grid } from '@mui/material'
import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import { getPublications } from '../../lib/api/publications'
import type { PublicationItem } from '../../types'

export default function BoletinesPage() {
  const [boletines, setBoletines] = useState<PublicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getPublications('boletin').then(setBoletines).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar los boletines.')).finally(() => setLoading(false)) }, [])

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
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
