import { useState } from 'react'
import {
  Accordion, AccordionDetails, AccordionSummary, Button, Chip, IconButton,
  Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import topes from '../../../../../shared/topes-contenido.json'
import TIPOS from '../../../../../shared/tipos-de-bloque.json'
import { BLOQUE_NUEVO, FORMULARIOS, NOMBRE_BLOQUE } from './formularios'
import { conClave, type Fila } from './filas'
import type { Bloque } from '../../../lib/api/contenido'

export default function EditorDeBloques({ filas, onCambio }: {
  filas: Fila[]
  onCambio: (filas: Fila[]) => void
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)

  const cambiar = (clave: number, cambios: object) =>
    onCambio(filas.map((f) => (f.clave === clave ? { ...f, bloque: { ...f.bloque, ...cambios } as Bloque } : f)))

  const quitar = (clave: number) => onCambio(filas.filter((f) => f.clave !== clave))

  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= filas.length) return
    const copia = [...filas]
    copia[indice] = filas[destino]
    copia[destino] = filas[indice]
    onCambio(copia)
  }

  const anadir = (tipo: string) => {
    setMenu(null)
    onCambio([...filas, conClave(BLOQUE_NUEVO[tipo] as Bloque)])
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          Bloques ({filas.length})
        </Typography>
        <Button startIcon={<AddIcon />} onClick={(e) => setMenu(e.currentTarget)}>Añadir bloque</Button>
        <Menu open={menu !== null} anchorEl={menu} onClose={() => setMenu(null)}>
          {TIPOS.tipos.map((tipo) => (
            <MenuItem key={tipo} onClick={() => anadir(tipo)}>{NOMBRE_BLOQUE[tipo] ?? tipo}</MenuItem>
          ))}
        </Menu>
      </Stack>

      {filas.map(({ bloque, clave }, indice) => {
        const Formulario = FORMULARIOS[bloque.tipo]
        return (
          <Accordion
            key={clave}
            defaultExpanded={false}
            disableGutters
            variant="outlined"
            // Sin desmontar, el contenido plegado (con la ayuda «...va sin
            // título») seguía en el documento aunque no se viera: quien usa
            // lector de pantalla podía toparse con campos de un bloque
            // cerrado, y un aviso genérico como «sin título» dejaba de ser
            // único en la pantalla y una búsqueda de texto no sabía a cuál
            // de los dos se refería.
            slotProps={{ transition: { unmountOnExit: true } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexGrow: 1, pr: 1 }}>
                <Chip size="small" label={NOMBRE_BLOQUE[bloque.tipo] ?? bloque.tipo} />
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {bloque.titulo || `Posición ${indice + 1} de ${filas.length}`}
                </Typography>
              </Stack>
              {/* Dentro del resumen, pero fuera del botón que pliega: los
                  controles no deben abrir y cerrar el bloque al pulsarlos. */}
              <Stack direction="row" onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Subir"><span>
                  <IconButton size="small" aria-label={`Subir el bloque ${indice + 1}`}
                    disabled={indice === 0} onClick={() => mover(indice, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
                </span></Tooltip>
                <Tooltip title="Bajar"><span>
                  <IconButton size="small" aria-label={`Bajar el bloque ${indice + 1}`}
                    disabled={indice === filas.length - 1} onClick={() => mover(indice, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
                </span></Tooltip>
                <Tooltip title="Quitar">
                  <IconButton size="small" color="error" aria-label={`Quitar el bloque ${indice + 1}`}
                    onClick={() => quitar(clave)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField
                  label="Título de sección (opcional)"
                  value={bloque.titulo}
                  onChange={(e) => cambiar(clave, { titulo: e.target.value })}
                  size="small" fullWidth
                  helperText="Encabezado encima del bloque. Vacío, el bloque va sin título."
                  slotProps={{ htmlInput: { maxLength: topes.titulo } }}
                />
                {Formulario
                  ? <Formulario bloque={bloque as never} onCambio={(cambios: object) => cambiar(clave, cambios)} />
                  : <Typography color="error">Este bloque es de un tipo que ya no existe: quítalo.</Typography>}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Stack>
  )
}
