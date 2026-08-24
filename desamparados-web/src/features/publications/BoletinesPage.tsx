import { Helmet } from 'react-helmet-async'
import { Grid } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import { getPublicationsByCategory } from '../../lib/mocks/publications'

export default function BoletinesPage() {
  const boletines = getPublicationsByCategory('boletin')

  return (
    <>
      <Helmet>
        <title>Boletines | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Boletines"
        subtitle="Revista anual de la Hermandad."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Boletines anuales" />
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
