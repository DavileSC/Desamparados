import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import AppButton from '../AppButton'
import GlassCard from '../GlassCard'
import type { BloqueLlamada as Datos } from '../../lib/api/contenido'

/**
 * Un texto y un botón que lleva a otra página del sitio.
 *
 * El destino siempre es interno (lo exige `bloques.schema.ts`), así que se
 * navega con el `Link` del router y no con un `<a>`: recargar la aplicación
 * entera para ir a otra página nuestra perdería la caché y el desplazamiento.
 *
 * El título del bloque lo pinta `BloquesDePagina` encima, como en los demás.
 */
export default function BloqueLlamada({ bloque }: { bloque: Datos }) {
  return (
    <GlassCard goldBorder sx={{ maxWidth: '850px', mx: 'auto', p: { xs: 3, md: 5 }, textAlign: 'center' }}>
      {bloque.texto && (
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 3 }}>
          {bloque.texto}
        </Typography>
      )}
      <Box>
        <AppButton component={Link} to={bloque.enlace}>{bloque.boton}</AppButton>
      </Box>
    </GlassCard>
  )
}
