import { Box, Typography } from '@mui/material'
import type { Acto } from '../types'
import { Lineas } from './esqueleto/Hueso'

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

/** La tarjeta mientras llega el acto: fecha, título, descripción y lugar en huesos. */
export function TarjetaEventoEsqueleto() {
  return (
    <Box sx={{ pl: 3, py: 1, borderLeft: '2px solid rgba(204, 196, 201, 0.3)' }}>
      <Box sx={{ mb: 0.5 }}><Lineas anchos={['38%']} linea={32} grosor={9} /></Box>
      <Box sx={{ mb: 0.5 }}><Lineas anchos={['72%']} linea={26.7} grosor={14} /></Box>
      <Lineas anchos={['96%', '58%']} linea={20} grosor={9} />
      <Box sx={{ mt: 1 }}><Lineas anchos={['34%']} linea={20} grosor={8} /></Box>
    </Box>
  )
}
