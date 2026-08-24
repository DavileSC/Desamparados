import { Box, Typography } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import SectionTitle from '../../components/SectionTitle'
import GlassCard from '../../components/GlassCard'
import EventCard from '../../components/EventCard'
import AnimatedSection from '../../components/AnimatedSection'
import { getUpcomingEvents } from '../../lib/mocks/events'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'

export default function EventsAndLive() {
  const events = getUpcomingEvents(4)

  return (
    <AnimatedSection
      id="live"
      sx={{
        py: { xs: 8, md: 12 },
        borderTop: '1px solid rgba(204, 196, 201, 0.1)',
      }}
    >
      <PageContainer>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
            gap: 4,
            alignItems: 'start',
          }}
        >
          <Box>
            <SectionTitle title="Agenda y Cultos" actionLabel="Ver agenda" actionHref="/actualidad/agenda" />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </Box>
          </Box>

          <GlassCard sx={{ p: 4, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <Typography variant="h4" component="h3" sx={{ mb: 3, textAlign: 'center', fontSize: '24px' }}>
              Sede Canónica en directo
            </Typography>
            <Box
              sx={{
                position: 'relative',
                aspectRatio: '16 / 9',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#100e11',
                border: '1px solid rgba(204, 196, 201, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                '&:hover img': { transform: 'scale(1.05)' },
              }}
            >
              <Box
                component="img"
                src="/images/live.jpg"
                alt="Sede Canónica en directo"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.3,
                  transition: 'transform 0.7s ease',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(16, 14, 17, 0.4)',
                  transition: 'background-color 0.3s ease',
                  '&:hover': { backgroundColor: 'rgba(16, 14, 17, 0.2)' },
                }}
              />
              <PlayCircleIcon
                sx={{
                  fontSize: 64,
                  color: 'text.primary',
                  opacity: 0.8,
                  zIndex: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { opacity: 1, transform: 'scale(1.1)' },
                }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ mt: 2, textAlign: 'center', color: 'text.secondary', fontSize: '12px', opacity: 0.6 }}
            >
              Si no puede visualizar el reproductor haga clic en el siguiente{' '}
              <Box component="a" href="#" sx={{ color: 'secondary.main', fontWeight: 700, textDecoration: 'underline' }}>
                enlace
              </Box>
              .
            </Typography>
          </GlassCard>
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
