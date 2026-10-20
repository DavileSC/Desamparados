import { MenuItem, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { Salida } from '../../lib/api/salidas'

/**
 * Con una sola salida no hay nada que elegir: no se pinta. `compacto`: un
 * desplegable, para que quepa en la línea de las zonas de la mesa.
 */
export default function SelectorSalida({ salidas, valor, onChange, compacto }: { salidas: Salida[]; valor: string; onChange: (slug: string) => void; compacto?: boolean }) {
  if (salidas.length < 2) return null
  if (compacto) {
    return (
      <TextField select size="small" label="Salida" value={valor} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: 170 }}>
        {salidas.map((s) => <MenuItem key={s.slug} value={s.slug}>{s.nombre}</MenuItem>)}
      </TextField>
    )
  }
  return (
    <ToggleButtonGroup exclusive size="small" value={valor} onChange={(_, v: string | null) => v && onChange(v)} aria-label="Salida">
      {salidas.map((s) => <ToggleButton key={s.slug} value={s.slug}>{s.nombre}</ToggleButton>)}
    </ToggleButtonGroup>
  )
}
