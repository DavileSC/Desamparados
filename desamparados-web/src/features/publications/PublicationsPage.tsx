import { Helmet } from 'react-helmet-async'
import { Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import { publicationItems } from '../../lib/mocks/publications'

export default function PublicationsPage() {
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
          <Grid container spacing={3}>
            {publicationItems.map((publication) => (
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
