import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { leyenda, type Datos } from './datosDeLaFicha'

interface Props {
  datos: Datos
  onCambiar: (d: Datos) => void
  /**
   * Plegados en una línea, con un botón para corregirlos: en el listado los
   * datos rara vez cambian y desplegados obligaban a bajar para ver la ropa.
   */
  plegados?: boolean
}

/**
 * Nombre, apellidos, nacimiento, teléfono y correo, ya rellenos. Se confirman
 * de un vistazo y solo se escribe si algo ha cambiado.
 */
export default function DatosPersona({ datos, onCambiar, plegados = false }: Props) {
  const [abiertos, setAbiertos] = useState(!plegados)
  const campo = (clave: keyof Datos, etiqueta: string, extra: object = {}) => (
    <TextField size="small" fullWidth label={etiqueta} value={datos[clave]} onChange={(e) => onCambiar({ ...datos, [clave]: e.target.value })} {...extra} />
  )

  if (!abiertos) {
    // La fecha de nacimiento ya va en la cabecera del panel: aquí, cómo localizarle.
    const resumen = [datos.telefono.trim(), datos.email.trim()].filter(Boolean).join(' · ')
    return (
      <Box component="section" aria-label="Datos" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" noWrap title={resumen} sx={{ minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>
          {resumen || 'Sin teléfono ni correo'}
        </Typography>
        <Button size="small" onClick={() => setAbiertos(true)} sx={{ flexShrink: 0 }}>Corregir datos</Button>
      </Box>
    )
  }

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
