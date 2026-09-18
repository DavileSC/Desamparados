import { useId, useState, type KeyboardEvent } from 'react'
import {
  Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ListItemIcon,
  ListItemText, Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { Category, TipoApunte } from '../../../lib/api/accounting'
import { errorNombreCategoria } from './apunte'
import { COLOR_GASTO, COLOR_INGRESO, eurosResumen, numero } from './formato'

interface Props {
  abierto: boolean
  categorias: Category[]
  onCerrar: () => void
  onCrear: (nombre: string, tipo: TipoApunte) => Promise<void>
  onRenombrar: (id: number, nombre: string) => Promise<void>
  onCambiarEstado: (id: number, activa: boolean) => Promise<void>
}

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

const GRUPOS: { tipo: TipoApunte; titulo: string; color: string; anadir: string }[] = [
  { tipo: 'INGRESO', titulo: 'Ingresos', color: COLOR_INGRESO, anadir: 'Añadir categoría de ingreso' },
  { tipo: 'GASTO', titulo: 'Gastos', color: COLOR_GASTO, anadir: 'Añadir categoría de gasto' },
]

/** «8 apuntes · 1.826 €»: lo que se ha usado este año, para decidir antes de tocarla. */
function uso(c: Category) {
  const apuntes = c.usoAnio?.apuntes ?? 0
  if (apuntes === 0) return 'Sin apuntes este año'
  return `${numero(apuntes)} ${apuntes === 1 ? 'apunte' : 'apuntes'} · ${eurosResumen(c.usoAnio?.importe ?? 0)}`
}

/** Campo de nombre en la propia fila, para renombrar o dar de alta. Intro guarda y Escape cancela. */
function CampoNombre({ etiqueta, valor, ocupado, textoGuardar, onCambiar, onGuardar, onCancelar }: {
  etiqueta: string; valor: string; ocupado: boolean; textoGuardar: string
  onCambiar: (valor: string) => void; onGuardar: () => void; onCancelar: () => void
}) {
  const fallo = errorNombreCategoria(valor)
  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !fallo && !ocupado) onGuardar()
    // Escape cancela la edición, no cierra la ventana entera.
    if (e.key === 'Escape') { e.stopPropagation(); onCancelar() }
  }
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', py: 1 }}>
      <TextField
        size="small"
        label={etiqueta}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onKeyDown={teclas}
        error={Boolean(valor) && Boolean(fallo)}
        helperText={valor && fallo ? fallo : undefined}
        slotProps={{ htmlInput: { maxLength: 60 } }}
        autoFocus
        sx={{ flex: 1 }}
      />
      <IconButton aria-label={textoGuardar} onClick={onGuardar} disabled={Boolean(fallo) || ocupado} sx={{ mt: 0.25, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}>
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton aria-label="Cancelar" onClick={onCancelar} disabled={ocupado} sx={{ mt: 0.25, bgcolor: 'action.hover' }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}

/**
 * Renombrar, desactivar, reactivar y dar de alta categorías, todo en la misma
 * ventana. Nada se borra: una categoría desactivada deja de ofrecerse al
 * apuntar, pero sus apuntes siguen en el libro con su nombre.
 *
 * Cada fila dice cuánto se ha usado este año, y las acciones van en un menú
 * «⋯»: dos botones de texto por fila, en el mismo tono, hacían que
 * «Desactivar» pesara tanto como «Renombrar».
 */
export default function GestionCategorias({ abierto, categorias, onCerrar, onCrear, onRenombrar, onCambiarEstado }: Props) {
  const idTitulo = useId()
  const [menu, setMenu] = useState<{ ancla: HTMLElement; categoria: Category } | null>(null)
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null)
  const [creando, setCreando] = useState<{ tipo: TipoApunte; nombre: string } | null>(null)
  const [verDesactivadas, setVerDesactivadas] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hacer = async (accion: () => Promise<void>, porDefecto: string) => {
    setOcupado(true); setError(null)
    try { await accion(); return true }
    catch (e: unknown) { setError(mensaje(e, porDefecto)); return false }
    finally { setOcupado(false) }
  }

  const guardarNombre = async () => {
    if (!editando) return
    if (await hacer(() => onRenombrar(editando.id, editando.nombre.trim()), 'No se ha podido renombrar la categoría.')) setEditando(null)
  }
  const crear = async () => {
    if (!creando) return
    if (await hacer(() => onCrear(creando.nombre.trim(), creando.tipo), 'No se ha podido crear la categoría.')) setCreando(null)
  }
  const cambiarEstado = (c: Category, activa: boolean) => {
    setMenu(null)
    void hacer(() => onCambiarEstado(c.id, activa), 'No se ha podido cambiar la categoría.')
  }
  const empezarARenombrar = (c: Category) => { setMenu(null); setCreando(null); setError(null); setEditando({ id: c.id, nombre: c.nombre }) }

  const cerrar = () => {
    if (ocupado) return
    setEditando(null); setCreando(null); setMenu(null); setError(null); setVerDesactivadas(false)
    onCerrar()
  }

  const desactivadas = categorias.filter((c) => c.activa === false)

  const marcaRecibos = (
    <Tooltip title="La usan los recibos: no se renombra">
      <Box
        component="span"
        role="img"
        tabIndex={0}
        aria-label="La usan los recibos: no se renombra"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 22, px: 1, borderRadius: 11, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}
      >
        <LockOutlinedIcon aria-hidden="true" sx={{ fontSize: 13 }} />Recibos
      </Box>
    </Tooltip>
  )

  const fila = (c: Category) => {
    if (editando?.id === c.id) {
      return (
        <Box component="li" key={c.id} sx={{ listStyle: 'none', borderTop: 1, borderColor: 'divider' }}>
          <CampoNombre
            etiqueta={`Nuevo nombre de «${c.nombre}»`}
            valor={editando.nombre}
            ocupado={ocupado}
            textoGuardar="Guardar el nombre"
            onCambiar={(nombre) => setEditando({ id: c.id, nombre })}
            onGuardar={() => void guardarNombre()}
            onCancelar={() => setEditando(null)}
          />
        </Box>
      )
    }
    const conMenu = menu?.categoria.id === c.id
    return (
      <Box
        component="li"
        key={c.id}
        sx={{
          listStyle: 'none', borderTop: 1, borderColor: 'divider',
          display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 52, py: 0.75,
          mx: -1.25, px: 1.25, borderRadius: 2, bgcolor: conMenu ? 'action.hover' : 'transparent',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{c.nombre}</Typography>
            {c.deRecibos && marcaRecibos}
          </Box>
          {/* En el móvil el uso baja debajo del nombre; con sitio, va a la derecha. */}
          <Typography color="text.secondary" sx={{ fontSize: 12.5, display: { sm: 'none' } }}>{uso(c)}</Typography>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: 13, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'block' } }}>{uso(c)}</Typography>
        <IconButton
          aria-label={`Más acciones de «${c.nombre}»`}
          aria-haspopup="menu"
          aria-expanded={conMenu}
          disabled={ocupado}
          onClick={(e) => setMenu({ ancla: e.currentTarget, categoria: c })}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
    )
  }

  const grupo = ({ tipo, titulo, color, anadir }: (typeof GRUPOS)[number]) => {
    const delTipo = categorias.filter((c) => c.tipo === tipo)
    const activas = delTipo.filter((c) => c.activa !== false)
    const total = delTipo.reduce((suma, c) => suma + (c.usoAnio?.importe ?? 0), 0)
    return (
      <Box component="section" aria-label={titulo} key={tipo}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
          <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
          <Typography component="h3" sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary' }}>{titulo}</Typography>
          <Typography component="span" sx={{ ml: 'auto', fontSize: 13, fontWeight: 600, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{eurosResumen(total)} este año</Typography>
        </Box>
        <Box component="ul" sx={{ m: 0, p: 0 }}>
          {activas.map(fila)}
          {activas.length === 0 && (
            <Box component="li" sx={{ listStyle: 'none', borderTop: 1, borderColor: 'divider', py: 1.5 }}>
              <Typography variant="body2" color="text.secondary">Todavía no hay ninguna.</Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          {creando?.tipo === tipo ? (
            <CampoNombre
              etiqueta={`Nombre de la nueva categoría de ${tipo === 'INGRESO' ? 'ingreso' : 'gasto'}`}
              valor={creando.nombre}
              ocupado={ocupado}
              textoGuardar="Crear la categoría"
              onCambiar={(nombre) => setCreando({ tipo, nombre })}
              onGuardar={() => void crear()}
              onCancelar={() => setCreando(null)}
            />
          ) : (
            <Button startIcon={<AddIcon />} disabled={ocupado} onClick={() => { setEditando(null); setError(null); setCreando({ tipo, nombre: '' }) }} sx={{ my: 0.5, ml: -1 }}>
              {anadir}
            </Button>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="sm" scroll="paper" aria-labelledby={idTitulo}>
      {/* Solo el título dentro de DialogTitle: MUI le pone el id que nombra la ventana. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', pr: 2 }}>
        <DialogTitle id={idTitulo} sx={{ flex: 1, fontFamily: (t) => t.typography.h1.fontFamily, fontWeight: 400, fontSize: 26, pb: 0.5 }}>Categorías</DialogTitle>
        <IconButton aria-label="Cerrar" onClick={cerrar} disabled={ocupado} sx={{ mt: 1.5 }}><CloseIcon /></IconButton>
      </Box>
      <DialogContent>
        <Typography color="text.secondary" sx={{ fontSize: 13.5, mb: 1.5 }}>Apuntes e importe de este año en cada una.</Typography>
        <Stack spacing={1.5}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {GRUPOS.map(grupo)}
          {desactivadas.length > 0 && (
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
              <Button
                onClick={() => setVerDesactivadas((v) => !v)}
                aria-expanded={verDesactivadas}
                startIcon={<ChevronRightIcon sx={{ transform: verDesactivadas ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />}
                sx={{ color: 'text.secondary', ml: -1 }}
              >
                Desactivadas ({desactivadas.length})
              </Button>
              <Collapse in={verDesactivadas}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mb: 0.5 }}>No se ofrecen al apuntar; sus apuntes siguen en el libro con su nombre.</Typography>
                <Box component="ul" sx={{ m: 0, p: 0 }}>
                  {desactivadas.map((c) => (
                    <Box component="li" key={c.id} sx={{ listStyle: 'none', borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48 }}>
                      <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.tipo === 'INGRESO' ? COLOR_INGRESO : COLOR_GASTO, flexShrink: 0 }} />
                      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14.5, color: 'text.secondary' }}>{c.nombre}</Typography>
                      <Button size="small" disabled={ocupado} onClick={() => cambiarEstado(c, true)} aria-label={`Reactivar «${c.nombre}»`}>Reactivar</Button>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={cerrar} disabled={ocupado}>Hecho</Button>
      </DialogActions>

      <Menu anchorEl={menu?.ancla} open={menu !== null} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {menu && !menu.categoria.deRecibos && (
          <MenuItem onClick={() => empezarARenombrar(menu.categoria)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Renombrar</ListItemText>
          </MenuItem>
        )}
        {menu && (
          <MenuItem onClick={() => cambiarEstado(menu.categoria, false)} sx={{ alignItems: 'flex-start', maxWidth: 280 }}>
            <ListItemIcon sx={{ mt: 0.25 }}><ArchiveOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary="Desactivar"
              secondary="Deja de ofrecerse al apuntar; sus apuntes siguen"
              slotProps={{ secondary: { sx: { whiteSpace: 'normal', fontSize: 12 } } }}
            />
          </MenuItem>
        )}
      </Menu>
    </Dialog>
  )
}
