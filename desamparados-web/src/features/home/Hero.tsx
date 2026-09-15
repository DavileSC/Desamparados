import { useEffect, useState, type MouseEvent } from 'react'
import { Box, Typography } from '@mui/material'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AppButton from '../../components/AppButton'
import { FUNDIDO_S, IMAGENES_POR_DEFECTO, INTERVALO_ROTACION_MS, OPACIDAD_FOTO } from './heroImagenes'
import { usePortada, useTextosPortada } from './useContenidoPortada'

// Desplazamiento máximo de la imagen (px) cuando el cursor está en el borde del hero
const PARALLAX_X = 14
const PARALLAX_Y = 9

export default function Hero() {
  const reduceMotion = useReducedMotion()

  // Los textos, por el hook que comparten los otros cinco bloques y no por una
  // copia de su expresión: el único test de «la API falla y salen los textos de
  // siempre» corre sobre el hook, y con la copia aquí este bloque —el que más
  // se ve— se quedaba justo fuera de esa red.
  const textos = useTextosPortada()

  // Las fotos las decide el CMS, y para ellas hace falta el `status` de la
  // consulta: hasta que llega la lista no se pinta ninguna, porque si se
  // pintara la de siempre mientras tanto cada visita empezaría con un fundido
  // de la foto vieja a la nueva. Llamar a las dos no cuesta otra petición:
  // react-query deduplica por la clave, que es la misma.
  const { data, status } = usePortada()
  const imagenes = status === 'pending' ? null : data && data.imagenes.length > 0 ? data.imagenes : IMAGENES_POR_DEFECTO
  const total = imagenes?.length ?? 0

  // Fundidos hechos: la foto visible es `tick % total`. Con una sola foto no
  // hay nada que rotar, y con prefers-reduced-motion tampoco se rota (home.css
  // anula además las transiciones y la rotación quedaría en cortes secos).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (total < 2 || reduceMotion) return
    const id = window.setInterval(() => {
      // En una pestaña en segundo plano no se avanza: al volver no hay salto.
      if (document.hidden) return
      setTick((t) => t + 1)
    }, INTERVALO_ROTACION_MS)
    return () => window.clearInterval(id)
  }, [total, reduceMotion])
  const actual = total > 0 ? tick % total : 0

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
        height: { xs: 'calc(100svh - 64px)', md: '100svh' },
        minHeight: 560,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        overflow: 'hidden',
        // Lo que se ve antes de que llegue la primera foto.
        backgroundColor: '#1d1b1e',
      }}
    >
      {/* Capa de imagen ligeramente mayor que el hero para que al moverse no asome el fondo.
          Las fotos van apiladas: la visible encima, y la que viene se monta debajo con
          antelación para que ya esté cargada cuando le toque fundirse. */}
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
        {imagenes?.map((imagen, i) => {
          // Se montan la visible, las ya enseñadas y la siguiente; las demás
          // no gastan red hasta que se acerca su turno.
          if (i > tick + 1) return null
          const activa = i === actual
          return (
            <Box
              key={`${i}-${imagen.url}`}
              component={motion.img}
              src={imagen.url}
              alt={imagen.descripcion}
              aria-hidden={activa ? undefined : true}
              fetchPriority={i === 0 ? 'high' : undefined}
              decoding="async"
              initial={{ opacity: 0 }}
              // La que entra se funde por encima; la que sale espera tapada a que
              // termine el fundido y se apaga de golpe. Si las dos se fundieran a
              // la vez, a mitad se vería el fondo oscuro a través de ambas.
              animate={{ opacity: activa ? OPACIDAD_FOTO : 0 }}
              transition={activa ? { duration: FUNDIDO_S, ease: 'easeInOut' } : { duration: 0, delay: FUNDIDO_S }}
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: { xs: '35% center', md: 'center' },
                zIndex: activa ? 2 : 1,
              }}
            />
          )
        })}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'linear-gradient(to top, #262326 0%, rgba(16,14,17,.76) 18%, rgba(16,14,17,.12) 65%), linear-gradient(to left, rgba(16,14,17,.38), transparent 70%)',
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
          pb: { xs: 5, md: 8 },
          // Mismo margen lateral que el logo de la barra de navegación
          px: { xs: '20px', md: '40px', xl: '48px' },
        }}
      >
        <Typography variant="overline" sx={{ color: '#ded3bd', letterSpacing: '0.2em', fontSize: { xs: 10, md: 12 }, mb: 2 }}>
          {textos.hero.ceja}
        </Typography>
        <Typography
          id="hero-title"
          variant="h1"
          component="h1"
          sx={{
            color: 'text.primary',
            mb: 2.5,
            fontSize: { xs: '38px', sm: '50px', md: '64px' },
            maxWidth: '780px',
            textWrap: 'balance',
            textShadow: '0 2px 24px rgba(0,0,0,.2)',
          }}
        >
          {textos.hero.titulo}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            maxWidth: '510px',
            ml: 'auto',
            mb: 3.5,
            fontSize: { xs: '16px', md: '18px' },
          }}
        >
          {textos.hero.parrafo}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: { xs: 1.5, md: 3 } }}>
          <AppButton component={Link} to="/corporacion" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ px: { xs: 2.5, md: 3.5 }, fontSize: { xs: 11, md: 13 } }}>
            {textos.hero.botonPrincipal}
          </AppButton>
          {/* Las noticias ya vienen justo debajo del hero; la segunda acción lleva a lo que más se consulta. */}
          <Box component={Link} to="/actualidad/agenda" sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, gap: 1, fontSize: 13, color: '#e4e2df', '&:hover': { color: 'white' } }}>
            {textos.hero.enlaceSecundario} <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
