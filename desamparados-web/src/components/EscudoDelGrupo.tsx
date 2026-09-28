import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

/**
 * El escudo del Grupo Parroquial, en blanco sobre fondo transparente. El
 * original es de trazo negro muy fino; el archivo de `public/images` ya viene
 * invertido y reducido, porque las barras donde se usa son todas de la misma
 * tinta oscura.
 */
const RUTA_ESCUDO = '/images/escudo-grupo.webp'

/**
 * Se dimensiona por altura y el ancho lo pone la proporción del archivo, así
 * que nunca empuja al texto de la marca que lleva al lado. Va sin texto
 * alternativo a propósito: acompaña siempre al nombre, y repetirlo solo haría
 * que el lector de pantalla lo dijera dos veces.
 */
export default function EscudoDelGrupo({ alto, sx }: { alto: number | string; sx?: SxProps<Theme> }) {
  return (
    <Box
      component="img"
      src={RUTA_ESCUDO}
      alt=""
      aria-hidden
      sx={{ height: alto, width: 'auto', display: 'block', flexShrink: 0, ...sx }}
    />
  )
}
