import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { site } from '../config/site'

/**
 * El escudo de la corporación para fondo oscuro (claro sobre transparente):
 * escudo-sobre-oscuro.png de su marca, o el genérico de partida. Las barras y
 * los marcos donde se usa son todos de la misma tinta oscura, y las placas de
 * las noticias y publicaciones sin foto lo ponen velado sobre su fondo.
 */
export const RUTA_ESCUDO = site.imagenes.escudo

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
