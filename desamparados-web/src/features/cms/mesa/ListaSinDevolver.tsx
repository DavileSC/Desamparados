import { Alert, Box, ButtonBase, CircularProgress, Paper, Typography } from '@mui/material'
import type { SinDevolver } from '../../../lib/api/mesa'
import { ropaSinDevolver } from './formato'

interface Props {
  filas: SinDevolver[] | undefined
  error: boolean
  seleccionado: number | null
  onElegir: (hermanoId: number) => void
}

/**
 * Quién tiene todavía algo del ropero, y qué: para ir reclamándolo. Quien
 * lleva túnica propia o no lleva túnica no aparece: no tiene nada prestado.
 * Se vacía sola a medida que la gente devuelve.
 */
export default function ListaSinDevolver({ filas, error, seleccionado, onElegir }: Props) {
  return (
    <Paper component="section" aria-label="Sin devolver" sx={{ p: 1.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', px: 1, pb: 1 }}>
        Sin devolver{filas ? ` · ${filas.length}` : ''}
      </Typography>
      {error && <Alert severity="error">No se ha podido leer quién tiene ropa sin devolver.</Alert>}
      {!filas && !error && <CircularProgress size={24} aria-label="Cargando quién no ha devuelto" sx={{ m: 1 }} />}
      {filas?.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 1, pb: 1 }}>Todo el ropero está devuelto.</Typography>}
      <Box role="list" sx={{ display: 'grid', gap: 0.25, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
        {filas?.map((f) => (
          <Box role="listitem" key={f.hermano.id}>
            <ButtonBase
              onClick={() => onElegir(f.hermano.id)}
              sx={{
                width: '100%', display: 'block', textAlign: 'left', px: 1, py: 0.9, borderRadius: 1,
                backgroundColor: f.hermano.id === seleccionado ? 'action.selected' : undefined,
                '&:hover, &:focus-visible': { backgroundColor: 'action.hover' },
              }}
            >
              <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>{f.hermano.nombre} {f.hermano.apellidos}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {ropaSinDevolver(f.prendas, f.cingulos.length)}{f.hermano.telefono ? ` · ${f.hermano.telefono}` : ''}
              </Typography>
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}
