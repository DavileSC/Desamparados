import { Helmet } from 'react-helmet-async'
import { Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import { getPublicationsByCategory } from '../../lib/mocks/publications'

export default function DossierPrensaPage() {
  const dossieres = getPublicationsByCategory('dossier')

  return (
    <>
      <Helmet>
        <title>Dossier de Prensa | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Dossier de Prensa"
        subtitle="Recopilación de apariciones mediáticas."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Apariciones mediáticas" />
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
