import { motion, useReducedMotion } from 'framer-motion'
import { Box, type SxProps, type Theme } from '@mui/material'

// Este componente SIEMPRE renderiza un <section> animado. No acepta `component`:
// antes, pasar component="section" sobrescribía motion.section por un <section> plano,
// las props whileInView/initial llegaban al DOM (warning de React) y la animación no corría.
interface AnimatedSectionProps {
  children: React.ReactNode
  delay?: number
  sx?: SxProps<Theme>
  id?: string
  className?: string
  'aria-labelledby'?: string
}

export default function AnimatedSection({ children, delay = 0, sx, ...props }: AnimatedSectionProps) {
  const reduceMotion = useReducedMotion()

  // Con prefers-reduced-motion activo (o en entornos sin IntersectionObserver)
  // renderizamos la sección visible desde el principio: nunca queda en opacity:0.
  if (reduceMotion) {
    return (
      <Box component="section" sx={sx} {...props}>
        {children}
      </Box>
    )
  }

  return (
    <Box
      component={motion.section}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      sx={sx}
      {...props}
    >
      {children}
    </Box>
  )
}
