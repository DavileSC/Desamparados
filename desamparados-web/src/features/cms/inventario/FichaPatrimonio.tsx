import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CampoImagen from '../CampoImagen'
import { MAX_FOTOS, leerTasacion, type FormFicha } from './ficha'

interface Props {
  valor: FormFicha
  onChange: (f: FormFicha) => void
}

/**
 * La ficha de patrimonio de un enser: fotos, descripción, autoría, materiales,
 * conservación y tasación. Lo que piden el seguro, el Obispado o un taller de
 * restauración. Todo opcional: un lote de hachetas se queda en sus cantidades.
 */
export default function FichaPatrimonio({ valor, onChange }: Props) {
  const cambiar = (c: Partial<FormFicha>) => onChange({ ...valor, ...c })
  const tasacionMal = leerTasacion(valor.valorTasacion) === undefined
  const cambiarFoto = (i: number, c: Partial<{ url: string; pie: string }>) =>
    cambiar({ fotos: valor.fotos.map((f, k) => (k === i ? { ...f, ...c } : f)) })

  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>Fotos</Typography>
        <CampoImagen valor={valor.imagenUrl} onCambio={(ruta) => cambiar({ imagenUrl: ruta })} etiqueta="Foto principal" ayuda="La que abre la ficha. Mejor de frente y con buena luz." />
        <Stack spacing={2} sx={{ mt: 2 }}>
          {valor.fotos.map((f, i) => (
            <Stack key={i} direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <CampoImagen valor={f.url} onCambio={(ruta) => cambiarFoto(i, { url: ruta })} etiqueta={`Foto ${i + 2}`} ayuda="Un detalle, el reverso, una marca de platero…" sinQuitar />
              </Box>
              <TextField label={`Pie de la foto ${i + 2}`} value={f.pie} onChange={(e) => cambiarFoto(i, { pie: e.target.value })} slotProps={{ htmlInput: { maxLength: 160 } }} sx={{ flex: 1 }} />
              <IconButton aria-label={`Quitar la foto ${i + 2}`} onClick={() => cambiar({ fotos: valor.fotos.filter((_, k) => k !== i) })}><DeleteOutlineIcon /></IconButton>
            </Stack>
          ))}
        </Stack>
        {valor.fotos.length < MAX_FOTOS && (
          <Button sx={{ mt: 1.5 }} onClick={() => cambiar({ fotos: [...valor.fotos, { url: '', pie: '' }] })}>Añadir otra foto</Button>
        )}
      </Box>

      <Box>
        <Typography component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>La pieza</Typography>
        <Stack spacing={2}>
          <TextField label="Descripción" value={valor.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 5000 } }} fullWidth />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Autor o taller" value={valor.autor} onChange={(e) => cambiar({ autor: e.target.value })} slotProps={{ htmlInput: { maxLength: 160 } }} />
            <TextField label="Época" value={valor.epoca} onChange={(e) => cambiar({ epoca: e.target.value })} helperText="«1958», «hacia 1890», «s. XVIII»" slotProps={{ htmlInput: { maxLength: 80 } }} />
            <TextField label="Materiales y técnica" value={valor.materiales} onChange={(e) => cambiar({ materiales: e.target.value })} slotProps={{ htmlInput: { maxLength: 255 } }} />
            <TextField label="Medidas" value={valor.dimensiones} onChange={(e) => cambiar({ dimensiones: e.target.value })} helperText="Alto × ancho × fondo" slotProps={{ htmlInput: { maxLength: 120 } }} />
          </Box>
          <TextField label="Conservación e intervenciones" value={valor.conservacion} onChange={(e) => cambiar({ conservacion: e.target.value })} multiline minRows={2}
            helperText="Su estado, y las restauraciones o limpiezas con su fecha y quién las hizo." slotProps={{ htmlInput: { maxLength: 5000 } }} fullWidth />
        </Stack>
      </Box>

      <Box>
        <Typography component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>Tasación</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
          <TextField label="Valor (€)" value={valor.valorTasacion} onChange={(e) => cambiar({ valorTasacion: e.target.value })} error={tasacionMal}
            helperText={tasacionMal ? 'Un importe, con dos decimales como mucho' : ' '} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <TextField label="Fecha" type="date" value={valor.fechaTasacion} onChange={(e) => cambiar({ fechaTasacion: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Tasado por" value={valor.tasadoPor} onChange={(e) => cambiar({ tasadoPor: e.target.value })} slotProps={{ htmlInput: { maxLength: 160 } }} />
        </Box>
      </Box>
    </Stack>
  )
}
