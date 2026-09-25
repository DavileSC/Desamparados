import { Box } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import type { MedioGaleria } from '../../lib/api/contenido'
import CartelInclinado from '../CartelInclinado'
import { imagenDe } from './formato'

/**
 * Las fotos como carteles verticales que se inclinan hacia el ratón, con el
 * pie encima de la imagen. Pulsar uno lo amplía en el visor. Para carteles de
 * cultos, estrenos o una tanda corta de fotos que se quiera lucir.
 */
export default function Carteles({ medios, columnas, onAbrir }: {
  medios: MedioGaleria[]
  columnas: number
  onAbrir: (indice: number, reproducir: boolean) => void
}) {
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none', m: 0, p: 0, display: 'grid', gap: { xs: 2, md: 4 },
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${columnas}, minmax(0, 1fr))` },
      }}
    >
      {medios.map((medio, i) => {
        const video = medio.tipo === 'video'
        return (
          <li key={`${medio.url}-${i}`}>
            <CartelInclinado
              imagen={imagenDe(medio)}
              etiqueta={`${video ? 'Ver el vídeo' : 'Ampliar la foto'}: ${medio.alt}`}
              titulo={medio.pie || undefined}
              onClick={() => onAbrir(i, video)}
            >
              {video && (
                <Box aria-hidden sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 56, color: '#fff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.6))' }} />
                </Box>
              )}
            </CartelInclinado>
          </li>
        )
      })}
    </Box>
  )
}
