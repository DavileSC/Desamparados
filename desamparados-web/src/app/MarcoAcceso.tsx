import { Outlet, Link } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import EscudoDelGrupo from '../components/EscudoDelGrupo'
import TransicionDePagina from '../components/TransicionDePagina'
import { designTokens } from '../theme'
import { site } from '../config/site'

export default function MarcoAcceso() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default',
      }}
    >
      <Box
        component={Link}
        to="/"
        sx={{
          position: 'absolute',
          top: 24,
          left: { xs: '20px', md: '64px' },
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          fontFamily: designTokens.fonts.heading,
          fontSize: '22px',
          lineHeight: 1,
          color: 'text.primary',
          textDecoration: 'none',
          zIndex: 10,
        }}
      >
        <EscudoDelGrupo alto={38} />
        {site.nombreCorto.toUpperCase()}
      </Box>

      <Container
        maxWidth="sm"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
        }}
      >
        <TransicionDePagina>
          <Outlet />
        </TransicionDePagina>
      </Container>
    </Box>
  )
}
