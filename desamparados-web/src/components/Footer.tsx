import { useState } from 'react'
import { Box, Container, Typography, Link as MuiLink, IconButton, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import MailIcon from '@mui/icons-material/Mail'
import PhoneIcon from '@mui/icons-material/Phone'
import FacebookIcon from '@mui/icons-material/Facebook'
import CloseIcon from '@mui/icons-material/Close'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import MapIcon from '@mui/icons-material/Map'
import { useCookieConsent } from '../hooks/useCookieConsent'

const socialLinks = [
  { icon: <FacebookIcon />, href: '#', label: 'Facebook' },
  { icon: <CloseIcon />, href: '#', label: 'X' },
  { icon: <PlayCircleIcon />, href: '#', label: 'YouTube' },
]

const legalLinks = [
  { label: 'Aviso Legal', to: '/aviso-legal' },
  { label: 'Política de Privacidad', to: '/politica-privacidad' },
  { label: 'Cookies', to: '/politica-cookies' },
]

const MAP_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3197.0!2d-4.42!3d36.72!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzbCNDMnMTIuMCJOIDTCsDI1JzEyLjAiVw!5e0!3m2!1ses!2ses!4v1600000000000!5m2!1ses!2ses'

export default function Footer() {
  const { accepted } = useCookieConsent()
  // RGPD: el iframe de Google Maps envía la IP del visitante a Google. Solo se carga si el
  // usuario ha aceptado las cookies o pulsa explícitamente "Mostrar mapa" (click-to-load).
  const [mapRequested, setMapRequested] = useState(false)
  const showMap = accepted || mapRequested
  const year = new Date().getFullYear()

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: 'background.paper',
        borderTop: '1px solid rgba(204, 196, 201, 0.3)',
        py: 6,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: '20px', md: '64px' } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
            gap: 4,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              component="div"
              sx={{ color: 'text.primary', mb: 2, fontSize: '24px' }}
            >
              Hermandad de Nuestra Señora de los Desamparados
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
                  info@desamparadosmalaga.com
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
                  Tel: 952 00 00 00
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontSize: '13px', pl: 3.5 }}
              >
                Lunes a Viernes: 18:00h - 21:00h
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
              {socialLinks.map((social) => (
                <IconButton
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Box>

            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px' }}>
              © {year} Hermandad de Nuestra Señora de los Desamparados. Todos los derechos reservados.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: { xs: 'flex-start', md: 'flex-end' },
              justifyContent: 'space-between',
              gap: 3,
            }}
          >
            <Box
              sx={{
                width: { xs: '100%', md: '80%' },
                height: '300px',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.05)',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showMap ? (
                <Box
                  component="iframe"
                  src={MAP_EMBED_URL}
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: 'grayscale(100%) invert(92%) contrast(83%)' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ubicación de la Hermandad"
                />
              ) : (
                <Box sx={{ textAlign: 'center', p: 3 }}>
                  <MapIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '13px' }}>
                    El mapa lo proporciona Google Maps. Al mostrarlo, tu dirección IP se enviará a Google.
                  </Typography>
                  <Button
                    onClick={() => setMapRequested(true)}
                    sx={{
                      color: 'text.primary',
                      border: '1px solid rgba(204, 196, 201, 0.3)',
                      px: 3,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    Mostrar mapa
                  </Button>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
              {legalLinks.map((link) => (
                <MuiLink
                  key={link.label}
                  component={Link}
                  to={link.to}
                  sx={{
                    color: 'text.secondary',
                    fontSize: '14px',
                    textDecoration: 'underline',
                    '&:hover': { color: 'secondary.main' },
                  }}
                >
                  {link.label}
                </MuiLink>
              ))}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
