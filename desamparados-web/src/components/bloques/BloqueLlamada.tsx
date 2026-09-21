import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../Boton'
import TarjetaCristal from '../TarjetaCristal'
import type { BloqueLlamada as Datos } from '../../lib/api/contenido'
import { esDestinoValido } from '../../lib/destinos'

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
    <TarjetaCristal goldBorder sx={{ maxWidth: '850px', mx: 'auto', p: { xs: 3, md: 5 }, textAlign: 'center' }}>
      {bloque.texto && (
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 3 }}>
          {bloque.texto}
        </Typography>
      )}
      {/* Sin destino que exista, sin botón: llevaría a «página no encontrada». */}
      {esDestinoValido(bloque.enlace) && (
        <Box>
          <Boton component={Link} to={bloque.enlace}>{bloque.boton}</Boton>
        </Box>
      )}
    </TarjetaCristal>
  )
}
