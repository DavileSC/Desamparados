import { TextField } from '@mui/material'

/**
 * Un texto de la web pública (portada o recorrido) editable desde el CMS.
 *
 * `ayuda` no es opcional a propósito: dice DÓNDE sale el campo en la página
 * pública. Sin eso, «antetítulo» o «ceja» no significan nada para quien no
 * ha hecho el diseño, y la pantalla se vuelve una adivinanza.
 *
 * `maxLength` repite el tope del esquema del backend para avisar mientras se
 * escribe en vez de con un 400 al guardar.
 */
export default function CampoTexto({
  etiqueta, valor, onCambio, ayuda, maxLength, multilinea = false,
}: {
  etiqueta: string
  valor: string
  onCambio: (valor: string) => void
  ayuda: string
  maxLength: number
  multilinea?: boolean
}) {
  return (
    <TextField
      label={etiqueta}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      helperText={ayuda}
      slotProps={{ htmlInput: { maxLength } }}
      multiline={multilinea}
      minRows={multilinea ? 3 : undefined}
      size="small"
      fullWidth
    />
  )
}
