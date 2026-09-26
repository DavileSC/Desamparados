import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles'
import { useMemo } from 'react'
import ContenedorDePagina from '../ContenedorDePagina'
import { GRANATE, PAPEL } from '../../features/inicio/estilos'

export type Fondo = 'ninguno' | 'papel' | 'granate' | 'oscuro' | 'foto'

/** Tinta sobre papel: los colores de la lista de la Agenda, que ya se leen bien ahí. */
const TINTA = '#1b1c1a'
const TINTA_SUAVE = '#4a454a'

/**
 * La franja de color de un bloque, de lado a lado de la ventana.
 *
 * Sale del contenedor de la página con un margen negativo calculado sobre el
 * ancho de la ventana (`50% - 50vw`) y vuelve a meter el contenido en un
 * contenedor de página: así la franja llega a los bordes y lo de dentro sigue
 * alineado con el resto. La página recorta lo que sobra por los lados
 * (`overflow-x: clip`), que en Windows es el ancho de la barra de
 * desplazamiento.
 *
 * El papel es claro: dentro, el tema pasa a claro (tinta sobre crema, y el
 * granate hace de color de acento, porque el dorado no se lee sobre papel).
 * Las demás son oscuras y se quedan con el tema de la web.
 */
export default function BandaDeFondo({ fondo, foto, children }: { fondo: Fondo; foto?: string; children: ReactNode }) {
  const tema = useTheme()
  const temaPapel = useMemo(() => createTheme(tema, {
    palette: {
      mode: 'light',
      background: { default: PAPEL, paper: '#ffffff' },
      text: { primary: TINTA, secondary: TINTA_SUAVE },
      secondary: { main: GRANATE, dark: '#5a131c', contrastText: '#ffffff' },
      divider: 'rgba(27, 28, 26, 0.12)',
    },
  }), [tema])

  if (fondo === 'ninguno') return <>{children}</>

  const color = { papel: PAPEL, granate: GRANATE, oscuro: '#0a090b', foto: '#0a090b' }[fondo]
  const banda = (
    <Box
      data-fondo={fondo}
      sx={{
        position: 'relative',
        isolation: 'isolate',
        mx: 'calc(50% - 50vw)',
        py: { xs: 6, md: 9 },
        backgroundColor: color,
        color: fondo === 'papel' ? TINTA : undefined,
        ...(fondo === 'foto' && foto ? {
          backgroundImage: `url("${foto}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          // El velo va encima de la foto y debajo del texto: la foto se intuye y el texto se lee.
          '&::before': { content: '""', position: 'absolute', inset: 0, zIndex: -1, backgroundColor: 'rgba(10, 9, 11, 0.78)' },
        } : {}),
      }}
    >
      <ContenedorDePagina>{children}</ContenedorDePagina>
    </Box>
  )

  return fondo === 'papel' ? <ThemeProvider theme={temaPapel}>{banda}</ThemeProvider> : banda
}
