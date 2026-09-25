import { useRef, type PointerEvent, type ReactNode } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { useReducedMotion } from 'framer-motion'

interface Props {
  imagen: string
  /** Lo que dice el botón a quien no ve la imagen: «Ampliar la foto: …». */
  etiqueta: string
  /** La línea pequeña en versalitas encima del título (un mes, una sección). */
  antetitulo?: string
  titulo?: string
  onClick: () => void
  /** Algo encima de la imagen, como el icono de play de un vídeo. */
  children?: ReactNode
}

/** Cuánto se inclina, en grados, con el ratón en el borde. */
const GIRO = 12

/**
 * Un cartel vertical que se inclina hacia el ratón, con un brillo que sigue al
 * puntero, como una lámina que se mira a contraluz. El texto flota un poco por
 * delante de la imagen.
 *
 * Solo con ratón: en una pantalla táctil el dedo tapa el cartel y la
 * inclinación no se vería, así que se queda quieto. Quien pide menos
 * movimiento lo ve también quieto.
 *
 * Es un botón (amplía, abre…): quien lo usa decide qué pasa al pulsarlo.
 */
export default function CartelInclinado({ imagen, etiqueta, antetitulo, titulo, onClick, children }: Props) {
  const quieto = useReducedMotion() ?? false
  const cartel = useRef<HTMLButtonElement>(null)

  const mueve = (e: PointerEvent<HTMLButtonElement>) => {
    const el = cartel.current
    if (!el || quieto || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.transform = `rotateY(${((x - 0.5) * GIRO).toFixed(2)}deg) rotateX(${((0.5 - y) * GIRO).toFixed(2)}deg) scale(1.03)`
    el.style.setProperty('--bx', `${(x * 100).toFixed(1)}%`)
    el.style.setProperty('--by', `${(y * 100).toFixed(1)}%`)
  }
  const suelta = () => {
    if (cartel.current) cartel.current.style.transform = ''
  }

  return (
    <Box sx={{ perspective: '900px' }}>
      <ButtonBase
        ref={cartel}
        onClick={onClick}
        onPointerMove={mueve}
        onPointerLeave={suelta}
        aria-label={etiqueta}
        sx={{
          position: 'relative', display: 'block', width: '100%', aspectRatio: '2 / 3', overflow: 'hidden', textAlign: 'left',
          transformStyle: 'preserve-3d', transition: 'transform .5s cubic-bezier(.2, .8, .2, 1)',
          boxShadow: '0 30px 50px -20px rgba(0,0,0,.75)', borderRadius: '4px',
          '&:hover .brillo, &.Mui-focusVisible .brillo': { opacity: 1 },
          '&.Mui-focusVisible': { outline: '2px solid #dec72b', outlineOffset: 4 },
        }}
      >
        <Box component="img" src={imagen} alt="" loading="lazy" decoding="async"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {children}
        {(antetitulo || titulo) && (
          <Box sx={{
            position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: '48px 14px 14px', md: '60px 18px 18px' },
            background: 'linear-gradient(transparent, rgba(16,14,17,.92))', transform: 'translateZ(40px)',
          }}>
            {antetitulo && (
              <Typography component="span" sx={{ display: 'block', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#e3d8bf' }}>
                {antetitulo}
              </Typography>
            )}
            {titulo && (
              <Typography component="span" sx={{ display: 'block', mt: antetitulo ? 0.75 : 0, fontSize: { xs: 17, md: 22 }, lineHeight: 1.2, color: '#fff' }}>
                {titulo}
              </Typography>
            )}
          </Box>
        )}
        <Box className="brillo" aria-hidden sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, transition: 'opacity .3s',
          background: 'radial-gradient(circle at var(--bx, 50%) var(--by, 50%), rgba(255, 240, 210, .22), transparent 55%)',
        }} />
      </ButtonBase>
    </Box>
  )
}
