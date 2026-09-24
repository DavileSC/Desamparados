import { Box, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { CinguloEnMesa } from '../../../lib/api/mesa'

interface Props {
  valor: CinguloEnMesa
  onCambiar: (valor: CinguloEnMesa) => void
  /** Los que quedan en el ropero. */
  quedan: number
  /**
   * Prestarlo no gasta uno del ropero: ya lo tiene prestado con esta
   * papeleta, o trae uno sin devolver y se le cambia por este.
   */
  sinGastar?: boolean
  /** Un desplegable en una sola fila, para el panel del listado (que no tenga que bajar). */
  compacto?: boolean
}

/**
 * El cíngulo, junto a la túnica: se lo lleva (prestado, se devuelve con el
 * resto), no quedan y se le debe, lleva el suyo o no lleva. Sin cíngulos en
 * el ropero no se puede prestar: se le debe y se le da cuando los haya.
 */
export default function CampoCingulo({ valor, onCambiar, quedan, sinGastar = false, compacto = false }: Props) {
  const puedePrestar = sinGastar || quedan > 0
  const ayuda = sinGastar ? 'Ya tiene uno prestado: se queda con ese'
    : quedan <= 0 ? 'No quedan cíngulos en el ropero'
      : `${quedan === 1 ? 'Queda 1' : `Quedan ${quedan}`} en el ropero`
  if (compacto) {
    return (
      <TextField
        select size="small" fullWidth label="Cíngulo" value={valor} onChange={(e) => onCambiar(e.target.value as CinguloEnMesa)}
        // Lo que queda en el ropero solo importa si se lo lleva o se le debe.
        helperText={valor === 'PRESTADO' || valor === 'DEBIDO' ? ayuda : undefined}
        slotProps={{ formHelperText: { sx: { color: !puedePrestar ? 'warning.main' : undefined } } }}
      >
        <MenuItem value="PRESTADO" disabled={!puedePrestar}>Se lo lleva</MenuItem>
        <MenuItem value="DEBIDO">Se le debe</MenuItem>
        <MenuItem value="PROPIO">Propio</MenuItem>
        <MenuItem value="NINGUNO">No lleva</MenuItem>
      </TextField>
    )
  }
  return (
    <Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.75 }}>Cíngulo</Typography>
      <ToggleButtonGroup exclusive size="small" fullWidth value={valor} onChange={(_e, v: CinguloEnMesa | null) => v && onCambiar(v)} aria-label="Cíngulo">
        <ToggleButton value="PRESTADO" disabled={!puedePrestar}>Se lo lleva</ToggleButton>
        <ToggleButton value="DEBIDO">Se le debe</ToggleButton>
        <ToggleButton value="PROPIO">Propio</ToggleButton>
        <ToggleButton value="NINGUNO">No lleva</ToggleButton>
      </ToggleButtonGroup>
      <Typography sx={{ fontSize: 12.5, mt: 0.5, color: !puedePrestar ? 'warning.main' : 'text.secondary' }}>
        {valor === 'DEBIDO' ? `Se le dará cuando haya: sale en el listado con «Le falta el cíngulo». ${ayuda}.` : ayuda}
      </Typography>
    </Box>
  )
}

/**
 * El cíngulo que se propone al dar la ropa: el que va con la túnica y, si toca
 * prestarlo y no queda ninguno, «se le debe».
 */
export function cinguloInicial(propuesto: CinguloEnMesa, quedan: number, sinGastar: boolean): CinguloEnMesa {
  return propuesto === 'PRESTADO' && quedan <= 0 && !sinGastar ? 'DEBIDO' : propuesto
}
