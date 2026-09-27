import { Box, type SxProps, type Theme } from '@mui/material'
import { keyframes } from '@mui/material/styles'

const brillo = keyframes`from { transform: translateX(-100%) } to { transform: translateX(100%) }`

/**
 * Una pieza de un esqueleto de carga: un rectángulo del tamaño de lo que va a
 * llegar (una línea de título, la foto de una tarjeta), con un brillo suave
 * que lo cruza despacio.
 *
 * Sobre el papel crema (`papel`) va en tinta muy leve; sobre la web oscura, en
 * blanco muy leve. El brillo se para con prefers-reduced-motion y dentro de un
 * `.esqueleto-quieto`, que es como se queda detrás del aviso cuando el
 * servidor no contesta.
 */
export default function Hueso({ papel = false, sx }: { papel?: boolean; sx?: SxProps<Theme> }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={[
        {
          display: 'block',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '3px',
          backgroundColor: papel ? 'rgba(27, 28, 26, 0.08)' : 'rgba(255, 255, 255, 0.07)',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            transform: 'translateX(-100%)',
            background: papel
              ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07), transparent)',
            animation: `${brillo} 1.6s ease-in-out infinite`,
          },
          '.esqueleto-quieto &::after': { display: 'none' },
          '@media (prefers-reduced-motion: reduce)': { '&::after': { display: 'none' } },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}

/** Una medida en px o en CSS (`clamp(…)`), o una por tamaño de pantalla. */
type Medida = number | string | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number | string>>

/**
 * Unas líneas de texto: tantas como `anchos`, cada una del ancho que diga, con
 * el alto de la línea (`linea`) para que ocupen lo mismo que el texto.
 * `grosor` es el alto del hueso dentro de ella.
 */
export function Lineas({ anchos, linea, grosor, papel }: { anchos: string[]; linea: Medida; grosor: Medida; papel?: boolean }) {
  return (
    <Box component="span" aria-hidden="true" sx={{ display: 'block' }}>
      {anchos.map((ancho, i) => (
        <Box key={i} component="span" sx={{ display: 'flex', alignItems: 'center', height: linea }}>
          <Hueso papel={papel} sx={{ width: ancho, height: grosor }} />
        </Box>
      ))}
    </Box>
  )
}
