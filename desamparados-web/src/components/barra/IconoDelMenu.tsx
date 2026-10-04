import { Box } from '@mui/material'
import { motion, useReducedMotion } from 'framer-motion'

const CURVA = [0.22, 1, 0.36, 1] as const

const ARRIBA = { cerrado: { top: 0, rotate: 0 }, abierto: { top: 4.25, rotate: 45 } }
const ABAJO = { cerrado: { top: 8.5, rotate: 0 }, abierto: { top: 4.25, rotate: -45 } }

/**
 * Las dos rayas del botón del menú del móvil, que se cruzan en una X al abrirlo.
 * Las pinta la barra (siempre cerradas) y el cajón, que nace con ellas cerradas
 * (`desdeCerradas`) y las cruza en el mismo sitio: así parece el mismo botón
 * aunque el cajón esté por encima de la barra.
 */
export default function IconoDelMenu({ abierto, desdeCerradas = false }: { abierto: boolean; desdeCerradas?: boolean }) {
  const quieto = useReducedMotion() ?? false
  const transition = { duration: quieto ? 0 : 0.45, ease: CURVA }
  const inicial = desdeCerradas ? 'cerrado' : false
  const estado = abierto ? 'abierto' : 'cerrado'
  const raya = { position: 'absolute', left: 0, right: 0, height: '1.5px', bgcolor: 'currentColor', borderRadius: 1 } as const
  return (
    <Box aria-hidden sx={{ position: 'relative', width: 22, height: 10 }}>
      <Box component={motion.span} variants={ARRIBA} initial={inicial} animate={estado} transition={transition} sx={raya} />
      <Box component={motion.span} variants={ABAJO} initial={inicial} animate={estado} transition={transition} sx={raya} />
    </Box>
  )
}
