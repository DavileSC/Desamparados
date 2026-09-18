import { Box, Button, IconButton, Stack } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

export interface Pastilla {
  /** Qué filtro es, para el lector de pantalla: «Quitar el filtro categoría». */
  nombre: string
  texto: string
  quitar: () => void
}

interface Props {
  pastillas: Pastilla[]
  /** Con dos o más, un botón las quita todas de una vez. */
  onQuitarTodas?: () => void
}

/** Los filtros activos de un listado, cada uno con su aspa. */
export default function PastillasFiltro({ pastillas, onQuitarTodas }: Props) {
  if (pastillas.length === 0) return null
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
      {/* Pastilla propia y no Chip: el aspa del Chip no es un botón para el lector de pantalla. */}
      {pastillas.map((p) => (
        <Box key={p.nombre} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, pl: 1.5, pr: 0.25, borderRadius: 999, backgroundColor: 'action.selected', fontSize: 13 }}>
          {p.texto}
          <IconButton size="small" aria-label={`Quitar el filtro ${p.nombre}`} onClick={p.quitar} sx={{ p: 0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      ))}
      {onQuitarTodas && pastillas.length >= 2 && (
        <Button size="small" onClick={onQuitarTodas} sx={{ fontSize: 13 }}>Quitar todos</Button>
      )}
    </Stack>
  )
}
