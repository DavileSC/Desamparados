import type { ReactNode } from 'react'
import { Button, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { intercambiar } from './comunes'

/**
 * Una lista de piezas iguales dentro de un bloque (los botones, las preguntas,
 * los documentos): cada una en su recuadro con subir, bajar y quitar, y un
 * botón para añadir otra. Los límites son los del servidor, que lee el mismo
 * JSON de topes: aquí solo se evita ofrecer lo que se va a rechazar.
 */
export default function ListaEditable<T>({ elementos, onCambio, nuevo, nombre, maximo, minimo = 1, pintar }: {
  elementos: T[]
  onCambio: (elementos: T[]) => void
  /** Un elemento recién añadido, en blanco. */
  nuevo: () => T
  /** Cómo se llama cada pieza: «Botón», «Pregunta». */
  nombre: string
  maximo: number
  minimo?: number
  pintar: (elemento: T, cambiar: (cambios: Partial<T>) => void, indice: number) => ReactNode
}) {
  const cambiar = (indice: number, cambios: Partial<T>) =>
    onCambio(elementos.map((e, i) => (i === indice ? { ...e, ...cambios } : e)))
  const sobran = elementos.length > minimo
  const caben = elementos.length < maximo

  return (
    <Stack spacing={2}>
      {elementos.map((elemento, indice) => (
        <Stack key={indice} spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{nombre} {indice + 1}</Typography>
            <Tooltip title="Subir"><span>
              <IconButton size="small" aria-label={`Subir: ${nombre.toLowerCase()} ${indice + 1}`} disabled={indice === 0}
                onClick={() => onCambio(intercambiar(elementos, indice, indice - 1))}><ArrowUpwardIcon fontSize="small" /></IconButton>
            </span></Tooltip>
            <Tooltip title="Bajar"><span>
              <IconButton size="small" aria-label={`Bajar: ${nombre.toLowerCase()} ${indice + 1}`} disabled={indice === elementos.length - 1}
                onClick={() => onCambio(intercambiar(elementos, indice, indice + 1))}><ArrowDownwardIcon fontSize="small" /></IconButton>
            </span></Tooltip>
            <Tooltip title={sobran ? 'Quitar' : `El bloque necesita al menos ${minimo}`}><span>
              <IconButton size="small" color="error" aria-label={`Quitar: ${nombre.toLowerCase()} ${indice + 1}`} disabled={!sobran}
                onClick={() => onCambio(elementos.filter((_, i) => i !== indice))}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </span></Tooltip>
          </Stack>
          {pintar(elemento, (cambios) => cambiar(indice, cambios), indice)}
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={() => onCambio([...elementos, nuevo()])} disabled={!caben} sx={{ alignSelf: 'flex-start' }}>
        Añadir {nombre.toLowerCase()}
      </Button>
      {!caben && <Typography variant="caption" color="text.secondary">Caben {maximo} como mucho.</Typography>}
    </Stack>
  )
}
