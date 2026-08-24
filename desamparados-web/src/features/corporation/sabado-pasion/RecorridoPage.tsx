import { Helmet } from 'react-helmet-async'
import { Box, Grid, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'

const itinerary = [
  { time: '17:30', place: 'Salida desde la Parroquia de los Desamparados' },
  { time: '18:00', place: 'Plaza de la Constitución' },
  { time: '18:30', place: 'Calle Marqués de Larios' },
  { time: '19:00', place: 'Plaza de la Marina' },
  { time: '19:30', place: 'Paseo del Parque' },
  { time: '20:00', place: 'Plaza del Obispo' },
  { time: '20:30', place: 'Calle Molina Lario' },
  { time: '21:00', place: 'Plaza de la Constitución' },
  { time: '21:30', place: 'Entrada en la Parroquia de los Desamparados' },
]

export default function RecorridoPage() {
  return (
    <>
      <Helmet>
        <title>Recorrido | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Recorrido"
        subtitle="Itinerario oficial de la estación de penitencia."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', mb: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, textAlign: 'center' }}>
              El itinerario de la procesión del Sábado de Pasión recorre algunas de las
              calles más emblemáticas de Málaga. Los horarios son orientativos y pueden
              sufrir ligeras modificaciones en función del ritmo de la cofradía y de las
              circunstancias del momento.
            </Typography>
          </Box>

          <SectionTitle title="Itinerario y horarios aproximados" centered />
          <Grid container spacing={2}>
            {itinerary.map((item) => (
              <Grid key={item.place} size={{ xs: 12, md: 6 }}>
                <GlassCard
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    p: 3,
                  }}
                >
                  <Box
                    sx={{
                      minWidth: '80px',
                      textAlign: 'center',
                      px: 1.5,
                      py: 1,
                      borderRadius: '8px',
                      backgroundColor: 'rgba(110, 24, 34, 0.25)',
                      color: 'secondary.main',
                      fontWeight: 600,
                    }}
                  >
                    {item.time}
                  </Box>
                  <Typography variant="body1" sx={{ color: 'text.primary' }}>
                    {item.place}
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
