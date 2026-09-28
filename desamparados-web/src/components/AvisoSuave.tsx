import { Alert, type AlertProps } from '@mui/material'

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
          backgroundColor: 'rgba(222, 199, 43, 0.06)',
          border: '1px solid rgba(222, 199, 43, 0.18)',
          '& .MuiAlert-icon': { color: '#c9ab3c' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}
