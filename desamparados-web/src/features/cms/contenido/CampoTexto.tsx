import { TextField } from '@mui/material'

/** Hasta este tope (el de un título) un campo cabe en una línea; más largo, crece. */
const LARGO_DE_UNA_LINEA = 120

/**
 * Un texto de la web pública (portada o recorrido) editable desde el CMS.
 *
 * `ayuda` no es opcional a propósito: dice DÓNDE sale el campo en la página
 * pública. Sin eso, «antetítulo» o «ceja» no significan nada para quien no
 * ha hecho el diseño, y la pantalla se vuelve una adivinanza.
 *
 * `maxLength` repite el tope del esquema del backend para avisar mientras se
 * escribe en vez de con un 400 al guardar.
 *
 * Un campo de una línea con sitio para una frase entera (subtítulos,
 * descripciones de foto) crece hacia abajo en vez de cortarse por la derecha,
 * pero sigue siendo de una línea: un salto de línea se queda en espacio.
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
  const crece = !multilinea && maxLength > LARGO_DE_UNA_LINEA
  return (
    <TextField
      label={etiqueta}
      value={valor}
      onChange={(e) => onCambio(crece ? e.target.value.replace(/[\r\n]+/g, ' ') : e.target.value)}
      helperText={ayuda}
      slotProps={{ htmlInput: { maxLength } }}
      multiline={multilinea || crece}
      minRows={multilinea ? 3 : undefined}
      size="small"
      fullWidth
    />
  )
}
