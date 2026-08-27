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

export default function PublicationsPage() {
  const [items, setItems] = useState<PublicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getPublications().then(setItems).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar las publicaciones.')).finally(() => setLoading(false)) }, [])

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
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
