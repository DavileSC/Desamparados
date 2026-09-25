import { Box, Typography } from '@mui/material'
import { GOLD, SERIF } from '../../features/inicio/estilos'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueCita as Datos } from '../../lib/api/contenido'

/**
 * Unas palabras destacadas y de quién son: en serif con comillas (clásica),
 * a tamaño de titular (grande) o entre dos filetes dorados a lo ancho (franja).
 *
 * Va en un `<figure>` con su `<blockquote>` y su `<figcaption>`: es la forma
 * de decirle a un lector de pantalla que esto es una cita y quién la firma.
 */
export default function BloqueCita({ bloque }: { bloque: Datos }) {
  const estilo = valorDe(bloque, 'estilo')
  const izquierda = valorDe(bloque, 'alineacion') === 'izquierda'
  const grande = estilo === 'grande'
  const firma = [bloque.autor, bloque.fuente].filter((p) => p.trim() !== '').join(', ')

  return (
    <Box component="figure" sx={{
      m: 0, mx: 'auto', maxWidth: anchoMaximo(bloque, grande ? '1000px' : '820px'), textAlign: izquierda ? 'left' : 'center',
      ...(estilo === 'franja' && { py: { xs: 4, md: 5 }, borderTop: `1px solid ${GOLD}`, borderBottom: `1px solid ${GOLD}` }),
    }}>
      {estilo === 'clasica' && (
        <Typography aria-hidden sx={{ fontFamily: SERIF, fontSize: 88, lineHeight: 0.6, color: GOLD, mb: 1, height: 44 }}>“</Typography>
      )}
      <Box component="blockquote" sx={{ m: 0 }}>
        <Typography sx={{
          fontFamily: SERIF, color: 'text.primary', lineHeight: 1.35, letterSpacing: '-0.01em',
          fontSize: grande ? { xs: 30, md: 46 } : { xs: 22, md: 28 },
          fontStyle: grande ? 'normal' : 'italic',
        }}>
          {bloque.texto}
        </Typography>
      </Box>
      {firma && (
        <Typography component="figcaption" sx={{ mt: 2.5, color: 'secondary.main', fontSize: 13, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {firma}
        </Typography>
      )}
    </Box>
  )
}
