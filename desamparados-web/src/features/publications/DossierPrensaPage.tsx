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

export default function DossierPrensaPage() {
  const [dossieres, setDossieres] = useState<PublicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getPublications('dossier').then(setDossieres).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar los dossieres.')).finally(() => setLoading(false)) }, [])

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
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
