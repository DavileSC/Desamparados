import { Box } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import { publicationItems } from '../../lib/mocks/publications'

export default function FeaturedPublications() {
  const publications = publicationItems.slice(0, 3)

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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {publications.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} />
          ))}
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
