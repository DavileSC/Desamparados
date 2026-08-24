import { Helmet } from 'react-helmet-async'
import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'
import ImageGallery from '../../../components/ImageGallery'

const sections = [
  {
    label: 'Recorrido',
    description: 'Itinerario oficial de la estación de penitencia por las calles de Málaga.',
    to: '/corporacion/sabado-de-pasion/recorrido',
  },
  {
    label: 'Trono',
    description: 'El trono de nuestra Sagrada Titular, símbolo de devoción y arte cofrade.',
    to: '/corporacion/sabado-de-pasion/trono',
  },
  {
    label: 'Enseres',
    description: 'Acompañamiento musical e insignias que acompañan a la corporación.',
    to: '/corporacion/sabado-de-pasion/enseres',
  },
]

export default function SabadoPasionPage() {
  return (
    <>
      <Helmet>
        <title>Sábado de Pasión | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Sábado de Pasión"
        subtitle="Nuestra salida procesional por las calles de Málaga."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', mb: 6 }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8, textAlign: 'center' }}>
              El Sábado de Pasión es el día grande de nuestra Hermandad. En esta jornada,
              Nuestra Señora de los Desamparados sale en estación de penitencia por el
              centro histórico de Málaga, acompañada por sus hermanos y por una multitud de
              devotos que llenan las calles de fe y emoción.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, textAlign: 'center' }}>
              La procesión es fruto del trabajo y la ilusión de toda una comunidad. Desde
              la preparación del trono hasta el acompañamiento musical, cada detalle está
              pensado para que la salida sea un auténtico acto de fe, arte y devoción.
            </Typography>
          </Box>

          <ImageGallery
            images={[
              { src: '/images/procesion.jpg', alt: 'Procesión del Sábado de Pasión' },
              { src: '/images/triduo.jpg', alt: 'Preparativos del Sábado de Pasión' },
              { src: '/images/hero.jpg', alt: 'Sagrada Titular' },
              { src: '/images/live.jpg', alt: 'Sede Canónica' },
            ]}
            columns={4}
          />

          <SectionTitle title="Descubre el Sábado de Pasión" centered />
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {sections.map((section) => (
              <Grid key={section.label} size={{ xs: 12, md: 4 }}>
                <Link to={section.to} style={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit' }}>
                  <GlassCard
                    sx={{
                      p: 4,
                      height: '100%',
                      '&:hover': { borderColor: 'rgba(193, 172, 0, 0.3)', transform: 'translateY(-4px)' },
                    }}
                  >
                    <Typography variant="h6" component="h3" sx={{ mb: 1.5, color: 'text.primary' }}>
                      {section.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                      {section.description}
                    </Typography>
                  </GlassCard>
                </Link>
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
