import { Box } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../Boton'
import { esDestinoValido } from '../../lib/destinos'
import { valorDe } from './presentacion'
import type { BloqueBotones as Datos } from '../../lib/api/contenido'

/**
 * Uno o varios botones en fila, cada uno a una página del sitio: el principal
 * en granate y los secundarios con contorno. En el móvil se apilan a lo ancho,
 * que es donde se pulsan bien con el dedo.
 */
export default function BloqueBotones({ bloque }: { bloque: Datos }) {
  const izquierda = valorDe(bloque, 'alineacion') === 'izquierda'
  const grande = valorDe(bloque, 'tamano') === 'grande'
  // Un destino que ya no existe no se pinta: llevaría a «página no encontrada».
  const validos = bloque.botones.filter((b) => b.texto.trim() !== '' && esDestinoValido(b.enlace))
  if (validos.length === 0) return null
  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: izquierda ? 'flex-start' : 'center',
      flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' },
      maxWidth: 1000, mx: 'auto',
    }}>
      {validos.map((boton, i) => (
        <Boton key={`${boton.enlace}-${i}`} component={Link} to={boton.enlace}
          appVariant={boton.estilo === 'principal' ? 'primary' : 'outline'}
          sx={grande ? { px: 5, py: 1.75, fontSize: '1rem' } : undefined}>
          {boton.texto}
        </Boton>
      ))}
    </Box>
  )
}
