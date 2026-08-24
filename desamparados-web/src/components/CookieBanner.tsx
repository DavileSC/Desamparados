import { Box, Typography, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { useCookieConsent } from '../hooks/useCookieConsent'

export default function CookieBanner() {
  const { accepted, accept, decline } = useCookieConsent()

  if (accepted === null || accepted) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(16, 14, 17, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(204, 196, 201, 0.2)',
        p: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          maxWidth: '1280px',
          mx: 'auto',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: '20px', md: '64px' },
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px', maxWidth: '900px' }}>
          Este sitio utiliza cookies técnicas necesarias para su funcionamiento. Puedes consultar nuestra{' '}
          <Box component={Link} to="/politica-cookies" sx={{ color: 'secondary.main', textDecoration: 'underline' }}>
            Política de Cookies
          </Box>{' '}
          para más información.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <Button
            onClick={decline}
            sx={{
              color: 'text.secondary',
              border: '1px solid rgba(204, 196, 201, 0.3)',
              px: 3,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Rechazar
          </Button>
          <Button
            onClick={accept}
            sx={{
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              px: 3,
              '&:hover': { backgroundColor: 'primary.dark' },
            }}
          >
            Aceptar
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
