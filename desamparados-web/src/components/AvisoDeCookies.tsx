import { Box, Typography, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { useConsentimientoDeCookies } from '../hooks/useConsentimientoDeCookies'
import { ESMALTE } from './esmalte'

export default function AvisoDeCookies() {
  const { sinDecidir, aceptar, rechazar } = useConsentimientoDeCookies()

  // Solo se muestra mientras el usuario no haya decidido. "Rechazar" también se recuerda.
  if (!sinDecidir) return null

  return (
    <Box
      role="dialog"
      aria-label="Aviso de cookies"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(7, 6, 8, 0.95)',
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
          Este sitio utiliza cookies técnicas necesarias para su funcionamiento. Si aceptas, además se
          cargarán contenidos de terceros (mapa de Google Maps) que pueden enviar tu dirección IP a sus
          servidores. Consulta nuestra{' '}
          <Box component={Link} to="/politica-cookies" sx={{ color: 'secondary.main', textDecoration: 'underline' }}>
            Política de Cookies
          </Box>{' '}
          para más información.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <Button
            onClick={rechazar}
            sx={{ ...ESMALTE.oscuro, px: 3 }}
          >
            Rechazar
          </Button>
          <Button
            onClick={aceptar}
            sx={{ ...ESMALTE.principal, px: 3 }}
          >
            Aceptar
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
