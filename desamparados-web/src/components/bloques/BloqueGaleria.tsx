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
  // Solo los que ya tienen imagen. Guardado nunca falta (lo exige el
  // servidor), pero la vista previa del CMS pinta el borrador, y una foto o un
  // vídeo recién añadidos darían un <img src=""> que vuelve a pedir la página.
  const listos = bloque.medios.filter((m) => (m.tipo === 'video' ? m.url !== '' && m.portada !== '' : m.url !== ''))
  if (listos.length === 0) return null
  return (
    <Box sx={{ maxWidth: '1000px', mx: 'auto' }}>
      <GaleriaMedios medios={listos} />
    </Box>
  )
}
