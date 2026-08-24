import { Helmet } from 'react-helmet-async'
import { Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import NewsCard from '../../../components/NewsCard'
import AnimatedSection from '../../../components/AnimatedSection'
import { newsItems } from '../../../lib/mocks/news'

export default function NoticiasPage() {
  return (
    <>
      <Helmet>
        <title>Noticias | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Noticias"
        subtitle="Últimas noticias de la Hermandad de los Desamparados."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Todas las noticias" />
          <Grid container spacing={3}>
            {newsItems.map((news) => (
              <Grid key={news.id} size={{ xs: 12, md: 6, lg: 3 }}>
                <NewsCard news={news} />
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
