import { useState, type ReactNode } from 'react'
import {
  Box, Button, ButtonBase, Chip, Collapse, IconButton,
  Menu, MenuItem, Paper, Stack, TextField, Tooltip, Typography,
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

export default function EditorDeBloques({ filas, onCambio, clavesInvalidas, vistaPrevia }: {
  filas: Fila[]
  onCambio: (filas: Fila[]) => void
  /**
   * Cómo queda el bloque en la web con lo escrito. Se pinta encima de su
   * formulario, y solo el del bloque abierto: montar la vista previa de todos
   * a la vez haría la pantalla pesada y larguísima.
   */
  vistaPrevia?: (bloque: Bloque) => ReactNode
  /**
   * Bloques que acaban de fallar la comprobación de guardado: se despliegan
   * aunque estén plegados por defecto, porque si no quien lee el aviso no
   * tiene forma de saber cuál de todos es ni de llegar hasta él.
   */
  clavesInvalidas?: Set<number>
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  // Plegado por defecto (`undefined`); una vez que quien edita pliega o
  // despliega uno a mano, su elección manda por encima de `clavesInvalidas`,
  // aunque el bloque siga sin corregir: ya ha visto el aviso y ha decidido.
  const [expandidoManual, setExpandidoManual] = useState<Record<number, boolean>>({})

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
        const abierto = expandidoManual[clave] ?? clavesInvalidas?.has(clave) ?? false
        const idCabecera = `bloque-${clave}-cabecera`
        const idDetalle = `bloque-${clave}-detalle`
        return (
          <Paper key={clave} variant="outlined">
            {/* Esto era un Accordion de MUI y no podía serlo: su AccordionSummary
                ES un <button>, así que los controles de reordenar y quitar
                quedaban dentro de otro botón. El navegador daba un error de
                hidratación en cada carga, y —peor— los absorbía: el botón de
                plegar se anunciaba como «Texto Posición 1 de 2 Subir Bajar
                Quitar el bloque 1» y los tres controles no existían para quien
                usa un lector de pantalla. La estructura de aquí es la del patrón
                de divulgación: el encabezado lleva SOLO el botón que pliega, y
                los controles son hermanos suyos, fuera de él. */}
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pr: 1 }}>
              <Box component="h3" sx={{ m: 0, flexGrow: 1, minWidth: 0, display: 'flex' }}>
                <ButtonBase
                  id={idCabecera}
                  aria-expanded={abierto}
                  aria-controls={idDetalle}
                  onClick={() => setExpandidoManual((actual) => ({ ...actual, [clave]: !abierto }))}
                  sx={{
                    flexGrow: 1, minWidth: 0, gap: 1, p: 1.5,
                    justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1,
                  }}
                >
                  <Chip component="span" size="small" label={NOMBRE_BLOQUE[bloque.tipo] ?? bloque.tipo} />
                  <Typography component="span" variant="body2" color="text.secondary" noWrap sx={{ flexGrow: 1 }}>
                    {bloque.titulo || `Posición ${indice + 1} de ${filas.length}`}
                  </Typography>
                  <ExpandMoreIcon
                    sx={{
                      color: 'text.secondary',
                      transform: abierto ? 'rotate(180deg)' : 'none',
                      transition: (t) => t.transitions.create('transform'),
                    }}
                  />
                </ButtonBase>
              </Box>
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
            {/* Sin desmontar, el contenido plegado (con la ayuda «...va sin
                título») seguía en el documento aunque no se viera: quien usa
                lector de pantalla podía toparse con campos de un bloque
                cerrado, y un aviso genérico como «sin título» dejaba de ser
                único en la pantalla y una búsqueda de texto no sabía a cuál
                de los dos se refería. */}
            <Collapse in={abierto} unmountOnExit>
              <Box id={idDetalle} role="region" aria-labelledby={idCabecera} sx={{ px: 2, pt: 1, pb: 2 }}>
                <Stack spacing={2}>
                  {vistaPrevia?.(bloque)}
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
              </Box>
            </Collapse>
          </Paper>
        )
      })}
    </Stack>
  )
}
