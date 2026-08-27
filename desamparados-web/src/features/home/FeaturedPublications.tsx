import { Alert, Box, CircularProgress } from '@mui/material'
import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import { getLatestPublications } from '../../lib/api/publications'
import type { PublicationItem } from '../../types'

export default function FeaturedPublications() {
  const [publications, setPublications] = useState<PublicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLatestPublications().then(setPublications).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar las publicaciones.')).finally(() => setLoading(false))
  }, [])

  return (
    <AnimatedSection
      sx={{
        py: { xs: 8, md: 12 },
        backgroundColor: 'background.paper',
        borderTop: '1px solid rgba(204, 196, 201, 0.1)',
      }}
    >
      <PageContainer>
        <SectionTitle
          title="Publicaciones"
          actionLabel="Ver todas"
          actionHref="/publicaciones"
        />
        {loading && <CircularProgress aria-label="Cargando publicaciones" />}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && publications.length === 0 && <Alert severity="info">No hay publicaciones disponibles.</Alert>}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {!loading && publications.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} />
          ))}
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
