import type { MouseEvent } from 'react'
import { Box, Typography } from '@mui/material'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import AppButton from '../../components/AppButton'

// Desplazamiento máximo de la imagen (px) cuando el cursor está en el borde del hero
const PARALLAX_X = 14
const PARALLAX_Y = 9

export default function Hero() {
  const reduceMotion = useReducedMotion()

  // Parallax que sigue levemente al ratón: la imagen se mueve en sentido contrario al
  // cursor (sensación de profundidad) con un muelle suave. Sin efecto en táctil
  // (no hay mousemove) ni con prefers-reduced-motion.
  const targetX = useMotionValue(0)
  const targetY = useMotionValue(0)
  const x = useSpring(targetX, { stiffness: 50, damping: 18, mass: 0.8 })
  const y = useSpring(targetY, { stiffness: 50, damping: 18, mass: 0.8 })

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (reduceMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5 // -0.5 … 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    targetX.set(-nx * 2 * PARALLAX_X)
    targetY.set(-ny * 2 * PARALLAX_Y)
  }

  const handleMouseLeave = () => {
    targetX.set(0)
    targetY.set(0)
  }

  return (
    <Box
      component="section"
      aria-labelledby="hero-title"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      sx={{
        position: 'relative',
        width: '100%',
        // Hero a pantalla completa: la siguiente sección queda por debajo del pliegue.
        // 100dvh en móvil tiene en cuenta la barra del navegador; 100vh es el fallback.
        height: '100vh',
        '@supports (height: 100dvh)': { height: '100dvh' },
        minHeight: 560,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        overflow: 'hidden',
      }}
    >
      {/* Imagen LCP: <img> real (priorizable y con alt) en vez de background-image.
          Versiones optimizadas (WebP + JPG, 960/1920px) en lugar del original de 5 MB. */}
      {/* Capa de imagen ligeramente mayor que el hero para que al moverse no asome el fondo */}
      <Box
        component={motion.div}
        style={{ x, y }}
        sx={{
          position: 'absolute',
          top: `-${PARALLAX_Y}px`,
          bottom: `-${PARALLAX_Y}px`,
          left: `-${PARALLAX_X}px`,
          right: `-${PARALLAX_X}px`,
          zIndex: 0,
          willChange: 'transform',
        }}
      >
        <Box component="picture" sx={{ position: 'absolute', inset: 0, display: 'block' }}>
          <source type="image/webp" media="(max-width: 960px)" srcSet="/images/hero-960.webp" />
          <source type="image/webp" srcSet="/images/hero-1920.webp" />
          <source media="(max-width: 960px)" srcSet="/images/hero-960.jpg" />
          <Box
            component="img"
            src="/images/hero.jpg"
            alt="Nuestra Señora de los Desamparados en su trono procesional"
            width={1920}
            height={1280}
            fetchPriority="high"
            decoding="async"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              opacity: 0.8,
            }}
          />
        </Box>
      </Box>
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
          textAlign: 'right',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pb: { xs: 8, md: 12 },
          // Mismo margen lateral que el logo de la barra de navegación
          px: { xs: '20px', md: '40px', xl: '48px' },
        }}
      >
        <Typography
          id="hero-title"
          variant="h1"
          component="h1"
          sx={{
            color: 'text.primary',
            mb: 3,
            fontSize: { xs: '36px', sm: '48px', md: '64px' },
          }}
        >
          Desamparados Málaga
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            maxWidth: '640px',
            ml: 'auto',
            mb: 5,
            fontSize: { xs: '16px', md: '18px' },
          }}
        >
          Devoción, historia y patrimonio en el corazón de Málaga. Acompáñanos en nuestro solemne caminar.
        </Typography>
        <AppButton component="a" href="#actualidad">
          Conoce el Grupo Parroquial
        </AppButton>
      </Box>
    </Box>
  )
}
