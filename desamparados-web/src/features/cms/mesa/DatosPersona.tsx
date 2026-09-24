import { Box, TextField, Typography } from '@mui/material'
import { leyenda, type Datos } from './datosDeLaFicha'

/**
 * Nombre, apellidos, nacimiento, teléfono y correo, ya rellenos. Se confirman
 * de un vistazo y solo se escribe si algo ha cambiado.
 */
export default function DatosPersona({ datos, onCambiar }: { datos: Datos; onCambiar: (d: Datos) => void }) {
  const campo = (clave: keyof Datos, etiqueta: string, extra: object = {}) => (
    <TextField size="small" fullWidth label={etiqueta} value={datos[clave]} onChange={(e) => onCambiar({ ...datos, [clave]: e.target.value })} {...extra} />
  )
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
      <Typography component="legend" sx={{ gridColumn: '1 / -1', ...leyenda }}>Datos</Typography>
      <Box sx={{ gridColumn: '1 / -1' }}>{campo('nombre', 'Nombre', { required: true })}</Box>
      {campo('primerApellido', 'Primer apellido', { required: true })}
      {campo('segundoApellido', 'Segundo apellido')}
      {campo('fechaNacimiento', 'Nacimiento', { type: 'date', required: true, slotProps: { inputLabel: { shrink: true } } })}
      {campo('telefono', 'Teléfono', { slotProps: { htmlInput: { inputMode: 'tel' } } })}
      <Box sx={{ gridColumn: '1 / -1' }}>{campo('email', 'Correo', { type: 'email' })}</Box>
    </Box>
  )
}
