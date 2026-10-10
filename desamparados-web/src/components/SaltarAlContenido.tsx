import type { RefObject } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'

/**
 * «Saltar al contenido», para quien navega con teclado: sin él, cada página
 * obliga a tabular por todo el menú antes de llegar al contenido. Invisible
 * hasta que se enfoca, que es el primer Tab de la página. Se enfoca a mano en
 * vez de dejar el #ancla, que cambiaría la dirección y no movería el foco.
 *
 * Lo usan los tres marcos (web pública, área de hermanos y CMS); cada uno
 * pasa su `<main>` (o la parte del contenido) y, si quiere, sus colores.
 */
export default function SaltarAlContenido({ destino, sx }: { destino: RefObject<HTMLElement | null>; sx?: SxProps<Theme> }) {
  return (
    <Box
      component="a"
      href="#contenido"
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        destino.current?.focus()
      }}
      sx={[
        {
          position: 'fixed', top: 8, left: 8, zIndex: (t) => t.zIndex.tooltip + 1,
          px: 2, py: 1.25, borderRadius: '6px',
          bgcolor: 'primary.main', color: 'primary.contrastText',
          fontWeight: 600, textDecoration: 'none',
          outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2,
          transform: 'translateY(-200%)',
          '&:focus': { transform: 'none' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      Saltar al contenido
    </Box>
  )
}
