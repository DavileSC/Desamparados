import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { useInView, useReducedMotion } from 'framer-motion'
import Boton from '../Boton'
import { GOLD } from '../../features/inicio/estilos'
import { useEnlaceVivo } from '../../hooks/useEnlaceVivo'
import { useModoEdicion } from './modoEdicion'
import { anchoMaximo } from './presentacion'
import type { BloqueAnillos as Datos } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

/** Lo que tarda el foco en pasar solo a la palabra siguiente. */
export const PASO_DEL_FOCO_MS = 3200

const ROMANOS = ['I', 'II', 'III'] as const

const llega = keyframes`from { opacity: 0; transform: translateY(12px); filter: blur(6px) } to { opacity: 1; transform: none; filter: none }`

/** Una esquina del marco que abraza la palabra enfocada. */
const esquina = (lado: 'arriba-izquierda' | 'arriba-derecha' | 'abajo-izquierda' | 'abajo-derecha', activa: boolean) => {
  const arriba = lado.startsWith('arriba')
  const izquierda = lado.endsWith('izquierda')
  return {
    position: 'absolute', width: { xs: 12, md: 18 }, height: { xs: 12, md: 18 },
    borderColor: GOLD, borderStyle: 'solid',
    borderWidth: `${arriba ? 2 : 0}px ${izquierda ? 0 : 2}px ${arriba ? 0 : 2}px ${izquierda ? 2 : 0}px`,
    ...(arriba ? { top: -6 } : { bottom: -6 }),
    ...(izquierda ? { left: -2 } : { right: -2 }),
    opacity: activa ? 1 : 0,
    transform: activa ? 'none' : 'scale(1.4)',
    transition: 'opacity .6s ease, transform .6s ease',
  } as const
}

/**
 * Los tres fines «en foco» (maqueta B, a partir del True Focus de React Bits):
 * los tres nombres en una línea grande; uno se ve nítido y enmarcado y los
 * otros dos desenfocados. Debajo, a la izquierda el texto común y a la derecha
 * el del fin enfocado, con su botón.
 *
 * El foco pasa solo de uno a otro mientras el bloque está a la vista, hasta
 * que alguien pulsa una palabra: desde ahí manda quien lee. Con «reducir
 * movimiento» o en el constructor no pasa solo. Todo se mueve despacio y sin
 * rebotes: es una página seria.
 *
 * Detrás, un velo granate y un grano muy finos (el Grainient de React Bits,
 * hecho con CSS y un filtro SVG: sin WebGL, que en un móvil modesto se nota).
 */
export default function FinesEnFoco({ bloque }: { bloque: Datos }) {
  const enlaceVivo = useEnlaceVivo()
  const marco = useRef<HTMLDivElement>(null)
  const aLaVista = useInView(marco, { amount: 0.4 })
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const [foco, setFoco] = useState(0)
  const [elegido, setElegido] = useState(false)
  const idDetalle = useId()
  // `useId` lleva dos puntos, que no valen dentro de `url(#…)`.
  const idGrano = `grano-${idDetalle.replace(/[^A-Za-z0-9_-]/g, '')}`
  const pasaSolo = aLaVista && !elegido && !reducir && !enConstructor

  useEffect(() => {
    if (!pasaSolo) return
    const reloj = window.setInterval(() => {
      // En una pestaña en segundo plano no avanza: al volver no hay salto.
      if (!document.hidden) setFoco((f) => (f + 1) % bloque.fines.length)
    }, PASO_DEL_FOCO_MS)
    return () => window.clearInterval(reloj)
  }, [pasaSolo, bloque.fines.length])

  const elegir = (indice: number) => {
    setFoco(indice)
    setElegido(true)
  }

  const actual = bloque.fines[foco] ?? bloque.fines[0]

  return (
    <Box ref={marco} sx={{ position: 'relative', maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto', isolation: 'isolate' }}>
      <Box aria-hidden sx={{
        position: 'absolute', inset: { xs: '-40px -20px', md: '-80px -120px' }, zIndex: -1, pointerEvents: 'none',
        // Que se desvanezca hacia los bordes: sin esto, el grano dibuja un rectángulo.
        maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 55%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 55%, transparent 100%)',
        background: `radial-gradient(60% 55% at 15% 25%, ${alfa(MARCA.principal, 0.28)}, transparent 70%), radial-gradient(55% 60% at 90% 70%, ${alfa(MARCA.acento, 0.06)}, transparent 70%)`,
      }}>
        <Box component="svg" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08, mixBlendMode: 'overlay' }}>
          <filter id={idGrano}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter={`url(#${idGrano})`} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
        {bloque.titulo && (
          <Typography component="h2" sx={{ fontSize: { xs: 12, md: 15 }, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 500, color: GOLD }}>
            {bloque.titulo}
          </Typography>
        )}
        <Typography aria-hidden sx={{ display: { xs: 'none', md: 'block' }, fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>
          Pulsa una palabra
        </Typography>
      </Box>

      <Box sx={{
        mt: { xs: 3, md: 5 }, py: { xs: 3, md: 6 },
        borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flexWrap: { md: 'wrap' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: { xs: 1.5, md: 2 },
      }}>
        {bloque.fines.map((fin, i) => {
          const activa = i === foco
          return (
            <ButtonBase
              key={i}
              onClick={() => elegir(i)}
              aria-pressed={activa}
              aria-controls={idDetalle}
              sx={{
                position: 'relative', px: { xs: 1.5, md: 2.5 }, py: 0.75,
                color: activa ? '#fff' : 'text.secondary',
                filter: activa ? 'none' : 'blur(4px)',
                opacity: activa ? 1 : 0.45,
                transition: 'filter .7s ease, opacity .7s ease, color .7s ease',
                '&:hover': { filter: 'none', opacity: activa ? 1 : 0.8 },
                '&.Mui-focusVisible': { filter: 'none', opacity: 1, outline: `2px solid ${GOLD}`, outlineOffset: 6 },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              {/* Crece con la ventana: a 84 px fijos, tres palabras largas no cabían en una fila a 900 px. */}
              <Box component="span" sx={{ fontSize: { xs: 44, sm: 60, md: 'min(84px, 6.2vw)', lg: 'min(108px, 7vw)' }, fontWeight: 200, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {fin.titulo}
              </Box>
              <Box component="span" aria-hidden sx={esquina('arriba-izquierda', activa)} />
              <Box component="span" aria-hidden sx={esquina('arriba-derecha', activa)} />
              <Box component="span" aria-hidden sx={esquina('abajo-izquierda', activa)} />
              <Box component="span" aria-hidden sx={esquina('abajo-derecha', activa)} />
            </ButtonBase>
          )
        })}
      </Box>

      <Box sx={{ mt: { xs: 4, md: 7 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 4, md: 12 }, alignItems: 'start' }}>
        {bloque.texto
          ? <Typography sx={{ fontSize: { xs: 18, md: 22 }, lineHeight: 1.7, fontWeight: 300, color: 'text.secondary' }}>{bloque.texto}</Typography>
          : <Box />}
        <Box
          id={idDetalle}
          key={foco}
          sx={{
            display: 'flex', flexDirection: 'column', gap: 2.5, pl: { xs: 2.5, md: 5 }, borderLeft: `1px solid ${alfa(MARCA.acento, 0.4)}`,
            animation: `${llega} .7s ease-out both`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Typography sx={{ fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD }}>
            {ROMANOS[foco]} · {actual.titulo}
          </Typography>
          {actual.texto && <Typography sx={{ fontSize: { xs: 17, md: 19 }, lineHeight: 1.75, color: 'text.primary' }}>{actual.texto}</Typography>}
          {actual.boton && enlaceVivo(actual.enlace) && (
            <Box>
              <Boton component={Link} to={actual.enlace} appVariant="secondary">{actual.boton}</Boton>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
