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
        // En el móvil, 100vh es el alto sin las barras del navegador: con ellas a
        // la vista, la página se pasaba y pedía scroll aunque el contenido cupiera.
        '@supports (height: 100dvh)': { minHeight: '100dvh' },
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
          top: { xs: 16, md: 24 },
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
        <EscudoDelGrupo alto={38} sx={{ height: { xs: 32, md: 38 } }} />
        {site.nombreCorto.toUpperCase()}
      </Box>

      {/* Ancho del acceso de hermanos, con sus dos puertas: las demás pantallas
          de este marco (nueva contraseña, primer acceso) fijan el suyo, más estrecho. */}
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // En el móvil, lo justo para no pegarse al escudo, que va encima, y
          // casi nada abajo: el acceso tiene que caber sin hacer scroll.
          pt: { xs: 7, md: 8 },
          pb: { xs: 2, md: 8 },
        }}
      >
        <TransicionDePagina>
          <Outlet />
        </TransicionDePagina>
      </Container>
    </Box>
  )
}
