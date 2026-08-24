import { Box } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import SectionTitle from '../../components/SectionTitle'
import NewsCard from '../../components/NewsCard'
import AnimatedSection from '../../components/AnimatedSection'
import { getLatestNews } from '../../lib/mocks/news'

export default function FeaturedNews() {
  const news = getLatestNews(4)
  const [featured, ...rest] = news

  return (
    <AnimatedSection id="actualidad" sx={{ py: { xs: 8, md: 12 } }}>
      <PageContainer>
        <SectionTitle title="Actualidad" actionLabel="Ver todas" actionHref="/actualidad/noticias" />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '6fr 6fr' },
            gap: 3,
            mb: 3,
          }}
        >
          <NewsCard news={featured} featured />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
            {rest.slice(0, 2).map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 3,
          }}
        >
          {rest.slice(2).map((item) => (
            <NewsCard key={item.id} news={item} />
          ))}
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
