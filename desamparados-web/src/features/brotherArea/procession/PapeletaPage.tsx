import { Typography, Grid } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'
import { processionTickets } from '../../../lib/mocks/brother'

export default function PapeletaPage() {
  const ticket = processionTickets[0]

  return (
    <>
      <Helmet>
        <title>Papeleta de Sitio | Desamparados</title>
      </Helmet>

      <AnimatedSection component="section" sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Papeleta de Sitio
          </Typography>

          <GlassCard sx={{ p: { xs: 3, md: 5 }, maxWidth: '600px' }}>
            <Typography variant="overline" sx={{ color: 'secondary.main', display: 'block', mb: 2 }}>
              Año {ticket.year}
            </Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                  Sección
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
                  {ticket.section}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                  Sitio
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
                  {ticket.seat}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                  Estado
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color:
                      ticket.status === 'assigned'
                        ? 'success.main'
                        : ticket.status === 'pending'
                          ? 'warning.main'
                          : 'error.main',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {ticket.status === 'assigned' && 'Asignada'}
                  {ticket.status === 'pending' && 'Pendiente'}
                  {ticket.status === 'not-assigned' && 'No asignada'}
                </Typography>
              </Grid>
            </Grid>
          </GlassCard>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
