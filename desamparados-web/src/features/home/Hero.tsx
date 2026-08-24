import { Box, Typography } from '@mui/material'
import AppButton from '../../components/AppButton'

export default function Hero() {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: '85vh', md: '80vh' },
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          backgroundImage: 'url(/images/hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.8,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'linear-gradient(to top, rgba(38, 35, 38, 1) 0%, rgba(38, 35, 38, 0.4) 50%, transparent 100%)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          pb: { xs: 8, md: 12 },
          px: { xs: '20px', md: '64px' },
          maxWidth: '1280px',
          mx: 'auto',
        }}
      >
        {/* <Typography
          variant="h1"
          component="h1"
          sx={{
            color: 'text.primary',
            mb: 3,
            fontSize: { xs: '36px', sm: '48px', md: '64px' },
          }}
        >
          Cofradía de los Desamparados
        </Typography> */}
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            maxWidth: '700px',
            mx: 'auto',
            mb: 5,
            fontSize: { xs: '16px', md: '18px' },
          }}
        >
          Devoción, historia y patrimonio en el corazón de Málaga. Acompáñanos en nuestro solemne caminar.
        </Typography>
        <AppButton component="a" href="#actualidad">
          Conoce la Hermandad
        </AppButton>
      </Box>
    </Box>
  )
}
