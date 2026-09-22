import { Box, Typography } from '@mui/material'
import type { Acto } from '../types'

interface TarjetaActoProps {
  acto: Acto
}

export default function TarjetaEvento({ acto }: TarjetaActoProps) {
  return (
    <Box
      sx={{
        pl: 3,
        py: 1,
        borderLeft: '2px solid',
        borderColor: acto.destacado ? 'secondary.main' : 'rgba(204, 196, 201, 0.3)',
      }}
    >
      <Typography
        variant="overline"
        sx={{ display: 'block', color: 'secondary.main', mb: 0.5, fontSize: '12px' }}
      >
        {acto.fecha} {acto.hora && `| ${acto.hora}`}
      </Typography>
      <Typography variant="h5" component="h3" sx={{ color: 'text.primary', mb: 0.5, fontSize: '20px' }}>
        {acto.titulo}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
        {acto.descripcion}
      </Typography>
      {acto.lugar && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', opacity: 0.7 }}>
          {acto.lugar}
        </Typography>
      )}
    </Box>
  )
}
