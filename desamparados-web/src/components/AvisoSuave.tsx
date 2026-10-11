import { Alert, type AlertProps } from '@mui/material'
import { MARCA, alfa } from '../theme/marca'

/**
 * Un aviso informativo con los colores de la web: velo oro sobre el fondo
 * oscuro. El `info` de MUI es azul, un color que la web no usa en ningún otro
 * sitio. No va en el tema porque el CMS lo hereda y allí el azul sí encaja.
 */
export default function AvisoSuave({ sx, ...props }: Omit<AlertProps, 'severity'>) {
  return (
    <Alert
      severity="info"
      {...props}
      sx={[
        {
          color: '#e8e1d4',
          backgroundColor: alfa(MARCA.acento, 0.06),
          border: `1px solid ${alfa(MARCA.acento, 0.18)}`,
          '& .MuiAlert-icon': { color: MARCA.acentoAviso },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}
