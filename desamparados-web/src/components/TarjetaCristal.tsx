import { Box, type BoxProps } from '@mui/material'
import { forwardRef } from 'react'

/** Sin borde (26-09-2026): la tarjeta se distingue por su fondo, no por un filete. */
type TarjetaCristalProps = BoxProps

const TarjetaCristal = forwardRef<HTMLDivElement, TarjetaCristalProps>(
  ({ sx, children, ...props }, ref) => (
    <Box
      ref={ref}
      sx={{
        // Sobre la banda de papel de un bloque (tema claro) el cristal oscuro
        // sería una mancha: ahí la tarjeta es blanca.
        background: (t) => (t.palette.mode === 'light' ? '#ffffff' : 'rgba(26, 24, 27, 0.72)'),
        backdropFilter: 'blur(12px)',
        borderRadius: '8px',
        transition: 'all 0.3s ease',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
)

TarjetaCristal.displayName = 'TarjetaCristal'

export default TarjetaCristal
