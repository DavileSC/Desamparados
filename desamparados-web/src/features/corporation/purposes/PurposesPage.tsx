import { Helmet } from 'react-helmet-async'
import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'
import AppButton from '../../../components/AppButton'

export default function PurposesPage() {
  return (
    <>
      <Helmet>
        <title>Nuestros Fines | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Nuestros Fines"
        subtitle="Caridad y formación como ejes de nuestra acción."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', mb: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, textAlign: 'center' }}>
              La Hermandad se propone, como fines esenciales, la práctica de la caridad
              hacia los necesitados y la formación integral de sus hermanos en la fe. Ambos
              ejes se alimentan mutuamente y dan sentido a toda nuestra actividad corporativa
              y pastoral.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Link to="/corporacion/nuestros-fines/caridad" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <GlassCard
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    p: { xs: 4, md: 6 },
                    height: '100%',
                    '&:hover': { borderColor: 'rgba(193, 172, 0, 0.3)', transform: 'translateY(-4px)' },
                  }}
                >
                  <Typography variant="h4" component="h2" sx={{ mb: 2, color: 'text.primary' }}>
                    Caridad
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary', lineHeight: 1.7 }}>
                    Ayuda social, obra asistencial y cercanía con los más desfavorecidos. La
                    caridad es el corazón de nuestra Hermandad, expresión visible del amor de
                    Dios a través del servicio concreto a los hermanos.
                  </Typography>
                  <AppButton appVariant="primary" sx={{ mt: 'auto' }}>
                    Conocer más
                  </AppButton>
                </GlassCard>
              </Link>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Link to="/corporacion/nuestros-fines/formacion" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <GlassCard
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    p: { xs: 4, md: 6 },
                    height: '100%',
                    '&:hover': { borderColor: 'rgba(193, 172, 0, 0.3)', transform: 'translateY(-4px)' },
                  }}
                >
                  <Typography variant="h4" component="h2" sx={{ mb: 2, color: 'text.primary' }}>
                    Formación
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary', lineHeight: 1.7 }}>
                    Educación en la fe, transmisión de valores cofrades y crecimiento
                    espiritual. La formación prepara a los hermanos para vivir con coherencia
                    su compromiso bautismal y cofrade.
                  </Typography>
                  <AppButton appVariant="primary" sx={{ mt: 'auto' }}>
                    Conocer más
                  </AppButton>
                </GlassCard>
              </Link>
            </Grid>
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
