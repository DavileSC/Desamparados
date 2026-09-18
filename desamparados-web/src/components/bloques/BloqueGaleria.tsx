import { Box } from '@mui/material'
import GaleriaMedios from '../GaleriaMedios'
import type { BloqueGaleria as Datos } from '../../lib/api/contenido'

/**
 * Pase de fotos y vídeos, el mismo componente que usa la página de la Sagrada
 * Titular. El vídeo no carga el marco de YouTube hasta que alguien pulsa el
 * play, y la dirección llega ya normalizada del servidor: aquí no se decide
 * nada sobre seguridad.
 *
 * El ancho es el del bloque de foto para que una galería y una foto sueltas
 * una debajo de otra no bailen.
 */
export default function BloqueGaleria({ bloque }: { bloque: Datos }) {
  return (
    <Box sx={{ maxWidth: '1000px', mx: 'auto' }}>
      <GaleriaMedios medios={bloque.medios} />
    </Box>
  )
}
