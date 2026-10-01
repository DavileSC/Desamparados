import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { Salida } from '../../lib/api/salidas'

/** Con una sola salida no hay nada que elegir: no se pinta. */
export default function SelectorSalida({ salidas, valor, onChange }: { salidas: Salida[]; valor: string; onChange: (slug: string) => void }) {
  if (salidas.length < 2) return null
  return (
    <ToggleButtonGroup exclusive size="small" value={valor} onChange={(_, v: string | null) => v && onChange(v)} aria-label="Salida">
      {salidas.map((s) => <ToggleButton key={s.slug} value={s.slug}>{s.nombre}</ToggleButton>)}
    </ToggleButtonGroup>
  )
}
