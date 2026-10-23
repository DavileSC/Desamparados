import type { ReactNode } from 'react'
import { Box, ButtonBase, Typography, type SxProps, type Theme } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { GOLD, GRANATE } from '../../features/inicio/estilos'
import { useTrasUnMomento } from './esperaDeCarga'

interface Props {
  /** Esperando al servidor, o el servidor no ha contestado. */
  estado: 'cargando' | 'error'
  /** Lo que va a llegar, en huesos: con su forma y su tamaño. */
  esqueleto: ReactNode
  /** Qué se está cargando, con su artículo: «las noticias», «la agenda». */
  que: string
  alReintentar: () => void
  /** Sobre el papel crema de la agenda. */
  papel?: boolean
  /**
   * El aviso arriba y no en el centro: para el cuerpo de una página entera, que
   * es alto y dejaría el aviso fuera de la pantalla.
   */
  avisoArriba?: boolean
  sx?: SxProps<Theme>
}

/**
 * Lo que ocupa el sitio de algo que viene del servidor mientras no está.
 *
 * - Los primeros 300 ms, el esqueleto invisible: reserva el hueco y, si el
 *   servidor contesta enseguida, no llega a verse nada.
 * - Después, el esqueleto con su brillo, que tiene la forma y el tamaño de lo
 *   que va a llegar: al llegar se cambia en el sitio y no se mueve nada.
 * - Si el servidor falla, el mismo esqueleto, quieto y apagado, con el aviso y
 *   «Volver a intentar» encima: la página no encoge ni se queda en blanco.
 */
export default function EnCarga({ estado, esqueleto, que, alReintentar, papel = false, avisoArriba = false, sx }: Props) {
  const visible = useTrasUnMomento(estado === 'cargando')

  if (estado === 'cargando') {
    return visible
      ? <Box role="status" aria-label={`Cargando ${que}`} sx={sx}>{esqueleto}</Box>
      : <Box aria-hidden="true" sx={[{ visibility: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx])]}>{esqueleto}</Box>
  }

  const plural = /^(las|los) /.test(que)
  return (
    <Box role="alert" sx={[{ position: 'relative' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box className="esqueleto-quieto" aria-hidden="true" sx={{ opacity: 0.35 }}>{esqueleto}</Box>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: avisoArriba ? 'start center' : 'center', justifyItems: 'center', gap: 1, p: 2, pt: avisoArriba ? { xs: 4, md: 6 } : 2, textAlign: 'center' }}>
        <Typography sx={{ maxWidth: '36ch', fontSize: 15, lineHeight: 1.6, color: papel ? '#3a3438' : '#e4dfe1' }}>
          No se {plural ? 'han' : 'ha'} podido cargar {que}. Inténtalo de nuevo en unos instantes.
        </Typography>
        <ButtonBase
          onClick={alReintentar}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 40, px: 1,
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: papel ? GRANATE : GOLD,
            '& svg': { fontSize: 18 },
            '&.Mui-focusVisible': { outline: `2px solid ${papel ? GRANATE : GOLD}`, outlineOffset: 2 },
          }}
        >
          <RefreshIcon aria-hidden /> Volver a intentar
        </ButtonBase>
      </Box>
    </Box>
  )
}
