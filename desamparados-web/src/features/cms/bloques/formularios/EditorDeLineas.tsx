import { Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import topes from '../../../../../../shared/topes-contenido.json'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import type { LineaDatos } from '../../../../lib/api/contenido'

const LINEA_NUEVA = { etiqueta: '', valor: '' }


/**
 * Las líneas de concepto y valor: las del bloque de datos y las de la tarjeta
 * del bloque de contacto. Las reglas son las mismas salvo el mínimo: un bloque
 * de datos sin líneas no pinta nada, pero la tarjeta de contacto sin líneas
 * simplemente no sale y el formulario ocupa todo el ancho.
 */
export default function EditorDeLineas({ lineas, onCambio, minimo }: {
  lineas: LineaDatos[]
  onCambio: (lineas: LineaDatos[]) => void
  minimo: 0 | 1
}) {
  const cambiar = (indice: number, campo: 'etiqueta' | 'valor', texto: string) =>
    onCambio(lineas.map((l, i) => (i === indice ? { ...l, [campo]: texto } : l)))

  const anadir = () => onCambio([...lineas, { ...LINEA_NUEVA }])
  const quitar = (indice: number) => onCambio(lineas.filter((_, i) => i !== indice))

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = lineas.length > minimo
  const cabenMas = lineas.length < topes.lineasPorBloque

  return (
    <Stack spacing={2}>
      {lineas.map((linea, indice) => (
        <Stack key={indice} direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'flex-start' } }}>
          <TextField label={`Concepto ${indice + 1}`} value={linea.etiqueta}
            onChange={(e) => cambiar(indice, 'etiqueta', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
          <TextField label="Valor" value={linea.valor}
            onChange={(e) => cambiar(indice, 'valor', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.lugar } }} />
          <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El bloque necesita al menos una línea'}><span>
            <IconButton size="small" color="error" aria-label={`Quitar la línea ${indice + 1}`}
              disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span></Tooltip>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir línea
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.lineasPorBloque} líneas, el máximo de un bloque.
        </Typography>
      )}
    </Stack>
  )
}

/**
 * Los tres colores de un hito. No hay un color libre: cada uno responde a algo
 * de la web, y así se le explica a quien edita.
 */
