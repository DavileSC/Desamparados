import { useState } from 'react'
import {
  Box, ButtonBase, Chip, Collapse, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem,
  Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import topes from '../../../../../shared/topes-contenido.json'
import Miniatura from './Miniatura'
import PanelDePresentacion from './PanelDePresentacion'
import { FORMULARIOS, NOMBRE_BLOQUE, SIN_TITULO } from '../bloques/formularios'
import { fechaCorta, libreDe, visibilidadDe } from '../../../components/bloques/presentacion'
import type { Fila } from '../bloques/filas'
import type { Bloque, Presentacion } from '../../../lib/api/contenido'

/** Lo que se puede hacer con un bloque desde su menú (⋮). */
export type AccionDeBloque = 'duplicar' | 'ocultar' | 'copiar' | 'seccion' | 'quitar'

interface Props {
  filas: Fila[]
  /** La clave de la fila abierta, o `null`. */
  abierta: number | null
  onAbrir: (clave: number | null) => void
  /** Un cambio en un bloque. `grupo` junta en un solo paso de deshacer lo que se teclea seguido. */
  onCambiarBloque: (clave: number, cambios: Partial<Bloque>, grupo?: string) => void
  onReordenar: (filas: Fila[]) => void
  onInsertar: (posicion: number) => void
  onAccion: (accion: AccionDeBloque, clave: number) => void
  /** Las que acaban de fallar al guardar: se marcan. */
  clavesInvalidas: Set<number>
  /** La dirección de la página, para el enlace con ancla. */
  ruta: string
}

/**
 * Los bloques de la página, en su orden, cada uno plegable con sus dos
 * pestañas (contenido y presentación).
 *
 * Se reordenan arrastrando por el asa (⠿) o con el teclado: en el asa,
 * espacio para cogerlo, flechas para moverlo y espacio para soltarlo. Las
 * flechas de subir y bajar siguen ahí para quien prefiera un clic.
 *
 * Entre bloque y bloque hay un «+» para añadir justo ahí, no solo al final.
 */
export default function ListaDeBloques({ filas, abierta, onAbrir, onCambiarBloque, onReordenar, onInsertar, onAccion, clavesInvalidas, ruta }: Props) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const posicionDe = (id: unknown) => filas.findIndex((f) => f.clave === id) + 1

  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const desde = filas.findIndex((f) => f.clave === active.id)
    const hasta = filas.findIndex((f) => f.clave === over.id)
    onReordenar(arrayMove(filas, desde, hasta))
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragEnd={alSoltar}
      accessibility={{
        screenReaderInstructions: { draggable: 'Para mover el bloque, pulsa espacio, muévelo con las flechas y vuelve a pulsar espacio para soltarlo. Escape lo deja donde estaba.' },
        announcements: {
          onDragStart: ({ active }) => `Has cogido el bloque ${posicionDe(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `El bloque ${posicionDe(active.id)} pasa a la posición ${posicionDe(over.id)}.` : ''),
          onDragEnd: ({ over }) => (over ? `Bloque soltado en la posición ${posicionDe(over.id)}.` : 'Bloque soltado.'),
          onDragCancel: () => 'Movimiento cancelado: el bloque vuelve a su sitio.',
        },
      }}
    >
      <SortableContext items={filas.map((f) => f.clave)} strategy={verticalListSortingStrategy}>
        <Stack>
          <Insertar posicion={0} total={filas.length} onInsertar={onInsertar} siempre={filas.length === 0} />
          {filas.map((fila, indice) => (
            <Box key={fila.clave}>
              <FilaDeBloque
                fila={fila}
                indice={indice}
                total={filas.length}
                abierta={abierta === fila.clave}
                invalida={clavesInvalidas.has(fila.clave)}
                onAlternar={() => onAbrir(abierta === fila.clave ? null : fila.clave)}
                onCambiar={(cambios, grupo) => onCambiarBloque(fila.clave, cambios, grupo)}
                onMover={(salto) => onReordenar(arrayMove(filas, indice, indice + salto))}
                onAccion={(accion) => onAccion(accion, fila.clave)}
                ruta={ruta}
              />
              <Insertar posicion={indice + 1} total={filas.length} onInsertar={onInsertar} siempre={indice === filas.length - 1} />
            </Box>
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  )
}

/**
 * El «+» entre dos bloques. Discreto hasta que se pasa por encima o se llega
 * con el teclado; el del final se ve siempre, con su texto.
 */
function Insertar({ posicion, total, onInsertar, siempre }: { posicion: number; total: number; onInsertar: (p: number) => void; siempre: boolean }) {
  const alFinal = posicion >= total
  return (
    <ButtonBase
      onClick={() => onInsertar(posicion)}
      aria-label={alFinal ? 'Añadir bloque al final' : `Añadir un bloque en la posición ${posicion + 1}`}
      sx={{
        width: '100%', justifyContent: 'center', gap: 1, borderRadius: 1.5, color: 'text.secondary',
        py: siempre ? 1.5 : 0.25, my: siempre ? 1 : 0.25,
        border: siempre ? '1px dashed' : '1px dashed transparent', borderColor: siempre ? 'divider' : 'transparent',
        opacity: siempre ? 1 : 0, transition: 'opacity .15s ease, border-color .15s ease',
        '&:hover, &.Mui-focusVisible': { opacity: 1, borderColor: 'primary.main', color: 'primary.main' },
      }}
    >
      <AddIcon fontSize="small" />
      {siempre && <Typography variant="body2" sx={{ fontWeight: 600 }}>Añadir bloque</Typography>}
    </ButtonBase>
  )
}

/** Por qué un bloque no se ve hoy, en una etiqueta corta; `null` si se ve. */
function avisoDeVisibilidad(bloque: Bloque): string | null {
  switch (visibilidadDe(bloque)) {
    case 'oculto': return 'Oculto'
    case 'antes': return `Desde el ${fechaCorta(libreDe(bloque, 'desde'))}`
    case 'despues': return 'Caducado'
    default: return libreDe(bloque, 'hasta') ? `Hasta el ${fechaCorta(libreDe(bloque, 'hasta'))}` : null
  }
}

function FilaDeBloque({ fila, indice, total, abierta, invalida, onAlternar, onCambiar, onMover, onAccion, ruta }: {
  fila: Fila
  indice: number
  total: number
  abierta: boolean
  invalida: boolean
  onAlternar: () => void
  onCambiar: (cambios: Partial<Bloque>, grupo?: string) => void
  onMover: (salto: -1 | 1) => void
  onAccion: (accion: AccionDeBloque) => void
  ruta: string
}) {
  const { bloque, clave } = fila
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: clave })
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [pestana, setPestana] = useState<'contenido' | 'presentacion'>('contenido')
  const Formulario = FORMULARIOS[bloque.tipo]
  const nombre = NOMBRE_BLOQUE[bloque.tipo] ?? bloque.tipo
  const aviso = avisoDeVisibilidad(bloque)
  const oculto = visibilidadDe(bloque) !== 'visible'
  const idCabecera = `bloque-${clave}-cabecera`
  const idDetalle = `bloque-${clave}-detalle`
  const opcionesCambiadas = Object.keys(bloque.presentacion ?? {}).length

  const accion = (a: AccionDeBloque) => { setMenu(null); onAccion(a) }

  return (
    <Box
      ref={setNodeRef}
      data-fila-bloque={indice}
      sx={{
        transform: CSS.Transform.toString(transform), transition,
        position: 'relative', zIndex: isDragging ? 2 : 'auto',
        border: 1, borderRadius: 2, backgroundColor: 'background.paper',
        borderColor: invalida ? 'error.main' : abierta ? 'primary.main' : 'divider',
        boxShadow: isDragging ? 8 : abierta ? '0 0 0 3px rgba(110, 24, 34, 0.12)' : 'none',
      }}
    >
      {/* El patrón de divulgación: el encabezado lleva SOLO el botón que
          pliega, y los controles son hermanos suyos, fuera de él. Dentro de un
          botón, un lector de pantalla se los tragaba. */}
      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', pl: 0.5, pr: 0.5 }}>
        <Tooltip title="Arrastra para mover">
          <IconButton ref={setActivatorNodeRef} size="small" aria-label={`Mover el bloque ${indice + 1}`} {...attributes} {...listeners}
            sx={{ cursor: isDragging ? 'grabbing' : 'grab', color: 'text.secondary', touchAction: 'none' }}>
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box component="h3" sx={{ m: 0, flexGrow: 1, minWidth: 0, display: 'flex' }}>
          <ButtonBase id={idCabecera} aria-expanded={abierta} aria-controls={idDetalle} onClick={onAlternar}
            sx={{ flexGrow: 1, minWidth: 0, gap: 1.25, py: 1, px: 0.75, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1 }}>
            <Box sx={{ flexShrink: 0, opacity: oculto ? 0.45 : 0.9, color: 'text.secondary' }}><Miniatura tipo={bloque.tipo} ancho={44} /></Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: 600, lineHeight: 1.3 }}>{nombre}</Typography>
              <Typography component="span" variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {bloque.titulo || `Posición ${indice + 1} de ${total}`}
              </Typography>
            </Box>
            {aviso && <Chip component="span" size="small" variant="outlined" color={oculto ? 'default' : 'primary'} label={aviso} sx={{ flexShrink: 0 }} />}
            <ExpandMoreIcon sx={{ color: 'text.secondary', flexShrink: 0, transform: abierta ? 'rotate(180deg)' : 'none', transition: (t) => t.transitions.create('transform') }} />
          </ButtonBase>
        </Box>
        <Tooltip title="Subir"><span>
          <IconButton size="small" aria-label={`Subir el bloque ${indice + 1}`} disabled={indice === 0} onClick={() => onMover(-1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
        </span></Tooltip>
        <Tooltip title="Bajar"><span>
          <IconButton size="small" aria-label={`Bajar el bloque ${indice + 1}`} disabled={indice === total - 1} onClick={() => onMover(1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
        </span></Tooltip>
        <Tooltip title="Más acciones">
          <IconButton size="small" aria-label={`Más acciones del bloque ${indice + 1}`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu open={menu !== null} anchorEl={menu} onClose={() => setMenu(null)}>
          <MenuItem onClick={() => accion('duplicar')}><ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon><ListItemText>Duplicar</ListItemText></MenuItem>
          <MenuItem onClick={() => accion('ocultar')}>
            <ListItemIcon>{bloque.presentacion?.oculto ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{bloque.presentacion?.oculto ? 'Mostrar en la web' : 'Ocultar en la web'}</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => accion('copiar')}><ListItemIcon><DriveFileMoveOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText>Copiar a otra página…</ListItemText></MenuItem>
          <MenuItem onClick={() => accion('seccion')}><ListItemIcon><BookmarkAddOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText>Guardar como sección…</ListItemText></MenuItem>
          <Divider />
          <MenuItem onClick={() => accion('quitar')} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>{`Quitar el bloque ${indice + 1}`}</ListItemText>
          </MenuItem>
        </Menu>
      </Stack>

      {/* Sin desmontar, el contenido plegado seguía en el documento aunque no
          se viera: un lector de pantalla podía toparse con campos de un bloque
          cerrado. */}
      <Collapse in={abierta} unmountOnExit>
        <Box id={idDetalle} role="region" aria-labelledby={idCabecera} sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Tabs value={pestana} onChange={(_, v) => setPestana(v)} variant="fullWidth" sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}>
            <Tab value="contenido" label="Contenido" />
            <Tab value="presentacion" label={opcionesCambiadas > 0 ? `Presentación (${opcionesCambiadas})` : 'Presentación'} />
          </Tabs>
          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            {pestana === 'contenido' ? (
              <Stack spacing={2}>
                {!SIN_TITULO.has(bloque.tipo) && (
                  <TextField label="Título de sección (opcional)" value={bloque.titulo} size="small" fullWidth
                    onChange={(e) => onCambiar({ titulo: e.target.value }, `${clave}-titulo`)}
                    helperText="Encabezado encima del bloque. Vacío, el bloque va sin título."
                    slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
                )}
                {Formulario
                  ? <Formulario bloque={bloque as never} onCambio={(cambios: object) => onCambiar(cambios as Partial<Bloque>, `${clave}-contenido`)} />
                  : <Typography color="error">Este bloque es de un tipo que ya no existe: quítalo.</Typography>}
              </Stack>
            ) : (
              <PanelDePresentacion bloque={bloque} ruta={ruta}
                onCambio={(presentacion: Presentacion | undefined) => onCambiar({ presentacion })} />
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}
