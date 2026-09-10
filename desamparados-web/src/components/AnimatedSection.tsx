import { motion, useReducedMotion } from 'framer-motion'
import { Box, type SxProps, type Theme } from '@mui/material'

// Curva de salida larga y suave (la misma que la escena de la procesión): el
// elemento llega rápido y se posa despacio, sin frenazo al final.
const CURVA = [0.22, 1, 0.36, 1] as const
const DURACION = 0.9
const RECORRIDO = 24
// Separación entre elementos de una misma cascada.
const PASO = 0.09

const ETIQUETAS = { div: motion.div, li: motion.li } as const

interface RevelaProps {
  children: React.ReactNode
  /** Posición en la cascada de su sección: cada paso retrasa la entrada 90 ms. */
  orden?: number
  retraso?: number
  as?: keyof typeof ETIQUETAS
  sx?: SxProps<Theme>
  className?: string
}

/**
 * Elemento que aparece subiendo al entrar en pantalla. Se dispara por su cuenta
 * (no depende de la sección), así que también entra bien si se monta tarde,
 * por ejemplo cuando las noticias llegan de la API con la sección ya a la vista.
 */
export function Revela({ children, orden = 0, retraso = 0, as = 'div', sx, className }: RevelaProps) {
  const reduceMotion = useReducedMotion()

  // Con prefers-reduced-motion activo, visible desde el principio: nunca queda en opacity:0.
  if (reduceMotion) {
    return <Box component={as} sx={sx} className={className}>{children}</Box>
  }

  return (
    <Box
      component={ETIQUETAS[as]}
      initial={{ opacity: 0, y: RECORRIDO }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: DURACION, delay: retraso + orden * PASO, ease: CURVA }}
      sx={sx}
      className={className}
    >
      {children}
    </Box>
  )
}

// Este componente SIEMPRE renderiza un <section> quieto: el fondo nunca se mueve,
// porque entre bloques oscuros seguidos se vería el corte. Lo que entra es el contenido.
interface AnimatedSectionProps {
  children: React.ReactNode
  delay?: number
  /** El contenido ya lleva sus propios <Revela>: no se envuelve en uno común. */
  cascada?: boolean
  sx?: SxProps<Theme>
  id?: string
  className?: string
  'aria-labelledby'?: string
}

export default function AnimatedSection({ children, delay = 0, cascada = false, sx, ...props }: AnimatedSectionProps) {
  return (
    <Box component="section" sx={sx} {...props}>
      {cascada ? children : <Revela retraso={delay}>{children}</Revela>}
    </Box>
  )
}
