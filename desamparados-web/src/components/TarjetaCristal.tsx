import { Box, type BoxProps } from '@mui/material'
import { forwardRef } from 'react'

interface TarjetaCristalProps extends BoxProps {
  goldBorder?: boolean
}

const TarjetaCristal = forwardRef<HTMLDivElement, TarjetaCristalProps>(
  ({ goldBorder = false, sx, children, ...props }, ref) => (
    <Box
      ref={ref}
      sx={{
        // Sobre la banda de papel de un bloque (tema claro) el cristal oscuro
        // sería una mancha: ahí la tarjeta es blanca con un filete.
        background: (t) => (t.palette.mode === 'light' ? '#ffffff' : 'rgba(18, 17, 19, 0.6)'),
        backdropFilter: 'blur(12px)',
        border: (t) => (goldBorder
          ? '1px solid rgba(193, 172, 0, 0.2)'
          : t.palette.mode === 'light' ? '1px solid rgba(27, 28, 26, 0.1)' : '1px solid rgba(204, 196, 201, 0.1)'),
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
