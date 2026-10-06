import type { ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'

/** La lista de fichas: una tarjeta con una fila por registro, separadas por un filete. */
export function ListaDeFichas({ etiqueta, vacia, pie, children }: { etiqueta: string; vacia?: ReactNode; pie?: ReactNode; children: ReactNode }) {
  return (
    <Paper>
      <Box component="ul" aria-label={etiqueta} sx={{ listStyle: 'none', m: 0, p: 0, '& > li + li': { borderTop: 1, borderColor: 'divider' } }}>
        {children}
      </Box>
      {vacia && <Typography sx={{ py: 4, px: 2, textAlign: 'center', color: 'text.secondary' }}>{vacia}</Typography>}
      {pie}
    </Paper>
  )
}

/**
 * Un registro: arriba lo que lo nombra y, a la derecha, lo que se hace con él;
 * debajo, sus datos. `color` pinta la marca de la izquierda, como en la tabla.
 */
export function Ficha({ titulo, acciones, color, children }: { titulo: ReactNode; acciones?: ReactNode; color?: string; children?: ReactNode }) {
  return (
    <Box component="li" sx={{ px: 2, py: 1.5, display: 'grid', gap: 0.75, ...(color && { boxShadow: `inset 4px 0 0 ${color}` }) }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{titulo}</Box>
        {acciones && <Box sx={{ display: 'flex', flexShrink: 0, mt: -0.5, mr: -1 }}>{acciones}</Box>}
      </Box>
      {children}
    </Box>
  )
}

/** Los datos de una ficha en dos columnas: rótulo pequeño y valor. */
export function DatosDeFicha({ children }: { children: ReactNode }) {
  return <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 16px' }}>{children}</Box>
}

export function Dato({ etiqueta, children, ancho = false }: { etiqueta: string; children: ReactNode; ancho?: boolean }) {
  return (
    <Box sx={{ minWidth: 0, ...(ancho && { gridColumn: '1 / -1' }) }}>
      <Typography component="dt" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>{etiqueta}</Typography>
      <Typography component="dd" sx={{ m: 0, fontSize: 14, overflowWrap: 'anywhere' }}>{children}</Typography>
    </Box>
  )
}
