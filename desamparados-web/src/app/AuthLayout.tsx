import { Outlet, Link } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import PageTransition from '../components/PageTransition'

export default function AuthLayout() {
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
          fontFamily: '"Libre Caslon Text", serif',
          fontSize: '22px',
          color: 'text.primary',
          textDecoration: 'none',
          zIndex: 10,
        }}
      >
        DESAMPARADOS
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
        <PageTransition>
          <Outlet />
        </PageTransition>
      </Container>
    </Box>
  )
}
