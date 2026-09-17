import { useState } from 'react'
import { Box, Typography, Link as MuiLink, IconButton, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import MailIcon from '@mui/icons-material/Mail'
import PhoneIcon from '@mui/icons-material/Phone'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import { site } from '../config/site'
import PageContainer from './PageContainer'
import MapIcon from '@mui/icons-material/Map'
import type { ReactNode } from 'react'
import { useCookieConsent } from '../hooks/useCookieConsent'

type SocialLink = { icon: ReactNode; href: string; label: string }

// Solo se pintan los perfiles cuya URL está confirmada en `site.redes`: un
// icono que lleva a `#` es un enlace muerto de cara al visitante.
const socialLinks: SocialLink[] = [
  { icon: <InstagramIcon />, href: site.redes.instagram, label: 'Instagram' },
  { icon: <XIcon />, href: site.redes.x, label: 'X' },
  { icon: <FacebookIcon />, href: site.redes.facebook, label: 'Facebook' },
  { icon: <PlayCircleIcon />, href: site.redes.youtube, label: 'YouTube' },
].flatMap((red) => (red.href ? [{ ...red, href: red.href }] : []))

const legalLinks = [
  { label: 'Aviso Legal', to: '/aviso-legal' },
  { label: 'Política de Privacidad', to: '/politica-privacidad' },
  { label: 'Cookies', to: '/politica-cookies' },
]

const MAP_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1067.3544649056719!2d-4.449098871278157!3d36.711765554466446!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd72f77028f9b929%3A0xe34fc3610f0d1398!2sIglesia%20Parroquial%20Santa%20Mar%C3%ADa%20Goretti!5e0!3m2!1ses!2ses!4v1789660222285!5m2!1ses!2ses'

export default function Footer() {
  const { accepted, reset: resetCookieConsent } = useCookieConsent()
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
      <PageContainer>
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
              {site.nombre}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
                  {site.contacto.email}
                </Typography>
              </Box>
              {site.contacto.telefono && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
                    Tel: {site.contacto.telefono}
                  </Typography>
                </Box>
              )}
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontSize: '13px', pl: 3.5 }}
              >
                {site.contacto.horario}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, mb: socialLinks.length > 0 ? 3 : 0 }}>
              {socialLinks.map((social) => (
                <IconButton
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Box>

            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px' }}>
              © {year} {site.nombre}. Todos los derechos reservados.
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
                  title="Ubicación del Grupo Parroquial"
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
              <MuiLink
                component="button"
                onClick={resetCookieConsent}
                sx={{
                  color: 'text.secondary',
                  fontSize: '14px',
                  textDecoration: 'underline',
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                  p: 0,
                  '&:hover': { color: 'secondary.main' },
                }}
              >
                Gestionar cookies
              </MuiLink>
            </Box>
          </Box>
        </Box>
      </PageContainer>
    </Box>
  )
}
