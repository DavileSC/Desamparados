import { Box, Grid, Typography } from '@mui/material'
import TarjetaCristal from '../TarjetaCristal'
import type { BloqueItinerario as Datos } from '../../lib/api/contenido'

/**
 * Las paradas de la procesión con su hora.
 *
 * Mismo marcado que tenía `RecorridoPage` a mano, para que convertir esa página
 * a bloques no le cambie el aspecto.
 */
export default function BloqueItinerario({ bloque }: { bloque: Datos }) {
  return (
    <Grid container spacing={2}>
      {bloque.paradas.map((parada, i) => (
        // El itinerario repite lugares (la procesión pasa dos veces por la
        // misma plaza): la clave necesita el índice o React se lía al
        // reordenar las paradas desde el CMS.
        <Grid key={`${parada.hora}-${parada.lugar}-${i}`} size={{ xs: 12, md: 6 }}>
          <TarjetaCristal sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 3 }}>
            <Box
              sx={{
                minWidth: '80px', textAlign: 'center', px: 1.5, py: 1, borderRadius: '8px',
                backgroundColor: 'rgba(110, 24, 34, 0.25)', color: 'secondary.main', fontWeight: 600,
              }}
            >
              {parada.hora}
            </Box>
            <Typography variant="body1" sx={{ color: 'text.primary' }}>{parada.lugar}</Typography>
          </TarjetaCristal>
        </Grid>
      ))}
    </Grid>
  )
}
