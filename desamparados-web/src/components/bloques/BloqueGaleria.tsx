import { Box } from '@mui/material'
import GaleriaMedios from '../GaleriaMedios'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueGaleria as Datos } from '../../lib/api/contenido'

/**
 * Fotos y vídeos: en pase (el de siempre, el mismo componente que usaba la
 * página de la Sagrada Titular), en cuadrícula o en mosaico. El vídeo no carga
 * el marco de YouTube hasta que alguien pulsa el play, y la dirección llega ya
 * normalizada del servidor: aquí no se decide nada sobre seguridad.
 *
 * Más ancho que el bloque de foto: el escenario de la galería tiene que
 * lucirse, y a 1000 px quedaba como una foto más.
 */
export default function BloqueGaleria({ bloque }: { bloque: Datos }) {
  // Solo los que ya tienen imagen. Guardado nunca falta (lo exige el
  // servidor), pero la vista previa del CMS pinta el borrador, y una foto o un
  // vídeo recién añadidos darían un <img src=""> que vuelve a pedir la página.
  const listos = bloque.medios.filter((m) => (m.tipo === 'video' ? m.url !== '' && m.portada !== '' : m.url !== ''))
  if (listos.length === 0) return null
  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto' }}>
      <GaleriaMedios
        medios={listos}
        formato={valorDe(bloque, 'disposicion') as 'pase' | 'cuadricula' | 'mosaico'}
        columnas={Number(valorDe(bloque, 'columnas'))}
      />
    </Box>
  )
}
