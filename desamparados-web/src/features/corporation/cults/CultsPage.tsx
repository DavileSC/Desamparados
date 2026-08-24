import { Helmet } from 'react-helmet-async'
import { Box, Grid, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'

const cults = [
  {
    title: 'Cultos mensuales',
    description: 'Celebración de la Eucaristía y momentos de oración fraterna con los hermanos, generalmente el primer sábado de mes.',
  },
  {
    title: 'Triduo a la Sagrada Titular',
    description: 'Tres días de intenso culto en honor a Nuestra Señora de los Desamparados, con predicación y celebración de los sacramentos.',
  },
  {
    title: 'Besamanos de la Virgen',
    description: 'Solemne besamanos durante el cual los devotos y hermanos pueden venerar de cerca la imagen de la Sagrada Titular.',
  },
  {
    title: 'Quinario al Santo Cristo',
    description: 'Cinco días de oración y reflexión en torno al misterio de la Cruz y la entrega redentora de Cristo.',
  },
  {
    title: 'Sábado de Pasión',
    description: 'Estación de penitencia por las calles de Málaga, momento culminante del año cofrade de la Hermandad.',
  },
  {
    title: 'Cultos de Navidad y Semana Santa',
    description: 'Celebraciones especiales que marcan los grandes momentos litúrgicos del año en la vida parroquial y cofrade.',
  },
]

export default function CultsPage() {
  return (
    <>
      <Helmet>
        <title>Cultos | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Cultos"
        subtitle="Celebraciones y devociones en honor a nuestra Sagrada Titular."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', mb: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, textAlign: 'center' }}>
              La vida espiritual de la Hermandad se alimenta de los cultos que celebramos a
              lo largo del año. Estas celebraciones son ocasiones privilegiadas para la
              oración comunitaria, la veneración a nuestra Sagrada Titular y el encuentro
              fraterno entre los hermanos.
            </Typography>
          </Box>

          <SectionTitle title="Celebraciones del año" centered />
          <Grid container spacing={3}>
            {cults.map((cult) => (
              <Grid key={cult.title} size={{ xs: 12, md: 6, lg: 4 }}>
                <GlassCard sx={{ p: 4, height: '100%' }}>
                  <Typography variant="h6" component="h3" sx={{ mb: 1.5, color: 'text.primary' }}>
                    {cult.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {cult.description}
                  </Typography>
                </GlassCard>
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
