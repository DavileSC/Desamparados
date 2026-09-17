import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import GlassCard from '../GlassCard'
import type { BloqueTarjetas as Datos } from '../../lib/api/contenido'

/** Mismo marcado que tenía `CorporationPage` a mano, para que convertir esa
 *  página a bloques no le cambie el aspecto. */
export default function BloqueTarjetas({ bloque }: { bloque: Datos }) {
  return (
    <Grid container spacing={3}>
      {bloque.tarjetas.map((tarjeta) => (
        <Grid key={tarjeta.enlace} size={{ xs: 12, md: 6, lg: 4 }}>
          <Box component={Link} to={tarjeta.enlace} sx={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <GlassCard sx={{ p: 4, '&:hover': { borderColor: 'rgba(193, 172, 0, 0.3)', transform: 'translateY(-4px)' } }}>
              <Typography variant="h6" component="h3" sx={{ mb: 1, color: 'text.primary' }}>{tarjeta.titulo}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{tarjeta.descripcion}</Typography>
            </GlassCard>
          </Box>
        </Grid>
      ))}
    </Grid>
  )
}
