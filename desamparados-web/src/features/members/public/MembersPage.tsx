import { Box, Typography, Grid } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'
import AppButton from '../../../components/AppButton'

export default function MembersPage() {
  return (
    <>
      <Helmet>
        <title>Hermanos | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Hermanos"
        subtitle="Forma parte de nuestra corporación."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Grid container spacing={6} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                Ser hermano del Grupo Parroquial de los Desamparados es formar parte de una
                comunidad de fe que vive la devoción a nuestra Sagrada Titular y trabaja
                por el bien común a través de la caridad, la formación y el culto.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                Como hermano podrás participar en los cultos, acompañar a la Virgen en su
                estación de penitencia, acceder al área privada de hermanos y contribuir
                activamente al crecimiento espiritual y social de la corporación.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                Te invitamos a unirte a esta gran familia. Si ya eres hermano, accede a tu
                área privada para consultar tu perfil, papeleta de sitio y recibos.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  alignItems: { xs: 'stretch', md: 'flex-start' },
                }}
              >
                <AppButton component="a" href="/hermanos/hazte-hermano" fullWidth>
                  Hazte hermano
                </AppButton>
                <AppButton
                  component="a"
                  href="/hermanos/acceso"
                  appVariant="outline"
                  fullWidth
                >
                  Acceso hermanos
                </AppButton>
              </Box>
            </Grid>
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
