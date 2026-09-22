/**
 * Los bloques que son una lista de piezas iguales: tarjetas, líneas de datos y
 * paradas de un itinerario. Los tres se añaden, se ordenan y se borran igual.
 */
import { Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import topes from '../../../../../../shared/topes-contenido.json'
import CampoEnlace from '../../contenido/CampoEnlace'
import EditorDeLineas from './EditorDeLineas'
import { intercambiar, type Props } from './comunes'
import type { BloqueTarjetas, BloqueDatos, BloqueItinerario } from '../../../../lib/api/contenido'

const TARJETA_NUEVA = { titulo: '', descripcion: '', enlace: '' }

export function FormularioTarjetas({ bloque, onCambio }: Props<BloqueTarjetas>) {
  const cambiar = (indice: number, campo: 'titulo' | 'descripcion' | 'enlace', valor: string) =>
    onCambio({ tarjetas: bloque.tarjetas.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)) })

  const anadir = () => onCambio({ tarjetas: [...bloque.tarjetas, { ...TARJETA_NUEVA }] })
  const quitar = (indice: number) =>
    onCambio({ tarjetas: bloque.tarjetas.filter((_, i) => i !== indice) })

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON:
  // una lista vacía no pinta nada, y el tope de arriba evita una página
  // interminable. El servidor sigue siendo quien decide; esto solo evita
  // ofrecer algo que se va a rechazar.
  const sobranParaQuitar = bloque.tarjetas.length > 1
  const cabenMas = bloque.tarjetas.length < topes.tarjetasPorBloque

  return (
    <Stack spacing={2}>
      {bloque.tarjetas.map((tarjeta, indice) => (
        <Stack key={indice} spacing={1.5} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Tarjeta {indice + 1}</Typography>
            <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El bloque necesita al menos una tarjeta'}><span>
              <IconButton size="small" color="error" aria-label={`Quitar la tarjeta ${indice + 1}`}
                disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
          </Stack>
          <TextField label={`Título de la tarjeta ${indice + 1}`} value={tarjeta.titulo}
            onChange={(e) => cambiar(indice, 'titulo', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
          <TextField label="Descripción" value={tarjeta.descripcion} multiline
            onChange={(e) => cambiar(indice, 'descripcion', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.textoTarjeta } }} />
          <CampoEnlace etiqueta={`Enlace de la tarjeta ${indice + 1}`} valor={tarjeta.enlace} opcional
            onCambio={(ruta) => cambiar(indice, 'enlace', ruta)}
            ayuda="Opcional. Sin enlace, la tarjeta es informativa y no lleva a ninguna parte." />
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir tarjeta
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.tarjetasPorBloque} tarjetas, el máximo de un bloque.
        </Typography>
      )}
    </Stack>
  )
}

export function FormularioDatos({ bloque, onCambio }: Props<BloqueDatos>) {
  return <EditorDeLineas lineas={bloque.lineas} onCambio={(lineas) => onCambio({ lineas })} minimo={1} />
}

const PARADA_NUEVA = { hora: '17:30', lugar: '' }

export function FormularioItinerario({ bloque, onCambio }: Props<BloqueItinerario>) {
  const cambiar = (indice: number, campo: 'hora' | 'lugar', texto: string) =>
    onCambio({ paradas: bloque.paradas.map((p, i) => (i === indice ? { ...p, [campo]: texto } : p)) })

  const anadir = () => onCambio({ paradas: [...bloque.paradas, { ...PARADA_NUEVA }] })
  const quitar = (indice: number) => onCambio({ paradas: bloque.paradas.filter((_, i) => i !== indice) })

  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.paradas.length) return
    onCambio({ paradas: intercambiar(bloque.paradas, indice, destino) })
  }

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = bloque.paradas.length > 1
  const cabenMas = bloque.paradas.length < topes.paradasPorItinerario

  return (
    <Stack spacing={1.5}>
      {bloque.paradas.map((parada, indice) => (
        // Clave posicional: una parada no tiene identificador y el itinerario
        // repite lugares. Aquí no importa como en la galería, porque ninguno de
        // estos campos guarda estado propio: son dos cuadros de texto.
        <Stack key={indice} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            label={`Hora ${indice + 1}`} value={parada.hora}
            onChange={(e) => cambiar(indice, 'hora', e.target.value)}
            size="small" sx={{ width: { sm: 120 } }}
            placeholder="17:30"
            slotProps={{ htmlInput: { maxLength: 5, inputMode: 'numeric' } }}
          />
          <TextField
            label="Lugar" value={parada.lugar}
            onChange={(e) => cambiar(indice, 'lugar', e.target.value)}
            size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.lugar } }}
          />
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Subir"><span>
              <IconButton size="small" aria-label={`Subir la parada ${indice + 1}`}
                disabled={indice === 0} onClick={() => mover(indice, -1)}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Bajar"><span>
              <IconButton size="small" aria-label={`Bajar la parada ${indice + 1}`}
                disabled={indice === bloque.paradas.length - 1} onClick={() => mover(indice, 1)}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El itinerario necesita al menos una parada'}><span>
              <IconButton size="small" color="error" aria-label={`Quitar la parada ${indice + 1}`}
                disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
          </Stack>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir parada
      </Button>
      <Typography variant="caption" color="text.secondary">
        {cabenMas
          ? 'La hora va en formato de 24 horas, como 17:30. Se enseña tal cual dentro de la pastilla.'
          : `Son ya ${topes.paradasPorItinerario} paradas, el máximo de un itinerario.`}
      </Typography>
    </Stack>
  )
}
