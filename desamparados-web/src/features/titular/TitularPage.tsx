import { Typography, Grid } from '@mui/material'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'
import GlassCard from '../../components/GlassCard'
import ImageGallery from '../../components/ImageGallery'

const links = [
  {
    title: 'Desamparados',
    description: 'Historia y devoción a nuestra Amantísima Titular.',
    href: '/sagrada-titular/desamparados',
  },
  {
    title: 'Ajuar',
    description: 'Manto, corona y joyas de la Sagrada Titular.',
    href: '/sagrada-titular/ajuar',
  },
]

export default function TitularPage() {
  return (
    <>
      <Helmet>
        <title>Sagrada Titular | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Sagrada Titular"
        subtitle="Nuestra Señora de los Desamparados."
        image="/images/hero-960.jpg"
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Typography
            variant="body1"
            sx={{
              maxWidth: '800px',
              mx: 'auto',
              textAlign: 'center',
              color: 'text.secondary',
              mb: 8,
              fontSize: { xs: '16px', md: '18px' },
            }}
          >
            Nuestra Señora de los Desamparados es la Sagrada Titular de esta Hermandad.
            Desde su llegada a la ciudad ha sido motivo de profunda devoción, acogiendo
            bajo su manto a cuantos acuden a Ella en busca de consuelo y esperanza.
          </Typography>

          <ImageGallery
            images={[
              { src: '/images/hero-thumb.jpg', alt: 'Nuestra Señora de los Desamparados' },
              { src: '/images/procesion.jpg', alt: 'Procesión de la Hermandad' },
              { src: '/images/triduo.jpg', alt: 'Solemne Triduo' },
              { src: '/images/live.jpg', alt: 'Sede Canónica' },
            ]}
            columns={4}
          />

          <Grid container spacing={4} sx={{ mt: 2 }}>
            {links.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.title}>
                <Link
                  to={item.href}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <GlassCard
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      p: 4,
                      '&:hover': { background: 'rgba(255, 255, 255, 0.05)' },
                    }}
                  >
                    <Typography
                      variant="h4"
                      component="h3"
                      sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {item.title}
                      <ArrowForwardIcon sx={{ color: 'secondary.main', fontSize: 24 }} />
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.description}
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
