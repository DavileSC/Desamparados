import { useId, useState } from 'react'
import { Box, Button, Menu, MenuItem, TextField, Typography } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import type { ApiProfile } from '../../../lib/api/perfil'
import { nombreDeFicha } from './fichasDeLaCuenta'

interface Props {
  fichas: ApiProfile[]
  elegida: number | null
  onElegir: (id: number) => void
  /** «cajon»: en el menú lateral, encima de la contraseña. «barra»: en la barra del móvil, donde el menú no se ve. */
  variante: 'cajon' | 'barra'
}

/**
 * La ficha que estás viendo, en el menú del área (16-10-2026): así se sabe con
 * quién está uno en «Mi perfil» desde cualquier pantalla. Procesión y Recibos
 * siguen siendo de toda la familia: elegir aquí lleva a «Mi perfil» con esa ficha.
 * Con una sola ficha no hay nada que elegir, pero se dice igual de quién es.
 */
export default function SelectorDeFicha({ fichas, elegida, onElegir, variante }: Props) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null)
  const idMenu = useId()
  const actual = fichas.find((f) => f.id === elegida) ?? fichas[0]
  if (!actual) return null
  const varias = fichas.length > 1

  if (variante === 'cajon') {
    return varias ? (
      <TextField select size="small" fullWidth label="Ficha que estás viendo" value={actual.id} onChange={(e) => onElegir(Number(e.target.value))}>
        {fichas.map((f) => <MenuItem key={f.id} value={f.id}>{nombreDeFicha(f)}</MenuItem>)}
      </TextField>
    ) : (
      <Box sx={{ px: 1 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>Ficha que estás viendo</Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{nombreDeFicha(actual)}</Typography>
      </Box>
    )
  }

  // En la barra ocupa el sitio del título: tiene que caber en un móvil de 360 junto al botón del menú.
  const texto = { fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } as const
  if (!varias) return <Typography sx={texto}>{nombreDeFicha(actual)}</Typography>
  return (
    <>
      <Button
        color="inherit"
        endIcon={<ArrowDropDownIcon />}
        onClick={(e) => setAncla(e.currentTarget)}
        aria-label={`Ficha que estás viendo: ${nombreDeFicha(actual)}. Cambiar de ficha`}
        aria-haspopup="menu"
        aria-expanded={ancla ? 'true' : undefined}
        aria-controls={ancla ? idMenu : undefined}
        sx={{ textTransform: 'none', letterSpacing: 0, minWidth: 0, px: 1, ml: -1, border: '1px solid rgba(204, 196, 201, 0.2)', borderRadius: 999 }}
      >
        <Box component="span" sx={texto}>{nombreDeFicha(actual)}</Box>
      </Button>
      <Menu id={idMenu} anchorEl={ancla} open={!!ancla} onClose={() => setAncla(null)}>
        {fichas.map((f) => (
          <MenuItem key={f.id} selected={f.id === actual.id} onClick={() => { setAncla(null); onElegir(f.id) }}>{nombreDeFicha(f)}</MenuItem>
        ))}
      </Menu>
    </>
  )
}
