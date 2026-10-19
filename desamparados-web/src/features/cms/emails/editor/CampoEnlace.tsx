import { Chip, Stack, TextField } from '@mui/material'
import { useModulos } from '../../../../hooks/useModulos'
import { AYUDA_ENLACE, PAGINAS_DE_LA_WEB, enlaceValido } from './enlaces'

interface Props {
  valor: string
  onCambio: (enlace: string) => void
  autoFocus?: boolean
}

/** A dónde lleva un enlace o un botón: una página de la web con un clic, o la dirección escrita. */
export default function CampoEnlace({ valor, onCambio, autoFocus }: Props) {
  const { activo } = useModulos()
  const mal = valor.trim() !== '' && !enlaceValido(valor)
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }} role="group" aria-label="Páginas de la web">
        {PAGINAS_DE_LA_WEB.filter((p) => !p.modulo || activo(p.modulo)).map((p) => (
          <Chip
            key={p.ruta}
            label={p.nombre}
            size="small"
            onClick={() => onCambio(p.ruta)}
            color={valor.trim() === p.ruta ? 'primary' : 'default'}
            variant={valor.trim() === p.ruta ? 'filled' : 'outlined'}
            aria-pressed={valor.trim() === p.ruta}
          />
        ))}
      </Stack>
      <TextField
        label="Dirección"
        size="small"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        error={mal}
        helperText={mal ? 'Esa dirección no vale. ' + AYUDA_ENLACE : AYUDA_ENLACE}
        autoFocus={autoFocus}
        slotProps={{ htmlInput: { maxLength: 500, spellCheck: false } }}
        fullWidth
      />
    </Stack>
  )
}
