import { Box, type BoxProps } from '@mui/material'
import { forwardRef } from 'react'

interface GlassCardProps extends BoxProps {
  goldBorder?: boolean
}

const TarjetaCristal = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ goldBorder = false, sx, children, ...props }, ref) => (
    <Box
      ref={ref}
      sx={{
        background: 'rgba(38, 35, 38, 0.6)',
        backdropFilter: 'blur(12px)',
        border: goldBorder ? '1px solid rgba(193, 172, 0, 0.2)' : '1px solid rgba(204, 196, 201, 0.1)',
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
