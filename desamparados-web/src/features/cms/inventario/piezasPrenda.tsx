import { Box, Button, IconButton, Tooltip } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { Link } from 'react-router-dom'
import type { Prenda } from '../../../lib/api/inventario'
import { ETIQUETA_ESTADO } from '../ropero'
import { ESTADO_PRENDA } from './colores'

/** Lo que se hace con una prenda desde la lista: prestar, devolver o darla por lavada. */
export interface AccionesPrenda {
  onPrestar: (prenda: Prenda) => void
  onDevolver: (prenda: Prenda) => void
  /** Ya está limpia: del lavado, disponible. */
  onLavada: (prenda: Prenda) => void
  onBorrar: (prenda: Prenda) => void
}

/** El estado de una prenda: punto de color sobre fondo suave, en los colores del ropero. */
export function PildoraEstado({ estado }: { estado: Prenda['estado'] }) {
  const { punto, fondo } = ESTADO_PRENDA[estado]
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 24, px: 1.25, borderRadius: 12,
        fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: fondo, color: 'text.primary',
        ...(estado === 'BAJA' && { border: 1, borderColor: 'divider' }),
      }}
    >
      <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: punto }} />
      {ETIQUETA_ESTADO[estado]}
    </Box>
  )
}

/**
 * El paso siguiente de la prenda, con su palabra: es la razón de estar en
 * esta pantalla. Sin relleno ni mayúsculas: hay uno por fila y, en granate,
 * la lista entera parecía un aviso. En el taller o de baja no hay paso.
 */
export function BotonPaso({ prenda: p, acciones, ancho = false }: { prenda: Prenda; acciones: AccionesPrenda; ancho?: boolean }) {
  const paso = p.estado === 'DISPONIBLE' ? { texto: 'Prestar', etiqueta: `Prestar ${p.numero}`, hacer: acciones.onPrestar }
    : p.estado === 'PRESTADA' ? { texto: 'Devolver', etiqueta: `Devolver ${p.numero}`, hacer: acciones.onDevolver }
      : p.estado === 'LAVADO' ? { texto: 'Ya lavada', etiqueta: `${p.numero} ya lavada`, hacer: acciones.onLavada }
        : null
  if (!paso) return null
  return (
    <Button
      variant="outlined"
      color="inherit"
      size="small"
      aria-label={paso.etiqueta}
      onClick={() => paso.hacer(p)}
      fullWidth={ancho}
      sx={{ textTransform: 'none', fontSize: 14, fontWeight: 600, letterSpacing: 0, minHeight: ancho ? 44 : 34, minWidth: 92, borderColor: 'divider', flexShrink: 0 }}
    >
      {paso.texto}
    </Button>
  )
}

/**
 * Editar y eliminar, a la vista. Eliminar estaba en un «⋯» para que no se
 * pulsara sin querer, pero era lo único que había dentro y ya pide
 * confirmación: el menú solo añadía un toque.
 */
export function MenuPrenda({ prenda: p, volver, onBorrar }: { prenda: Prenda; volver: string; onBorrar: (p: Prenda) => void }) {
  const ruta = `/cms/inventario/${p.id}/editar?tipo=prenda`
  return (
    <Box sx={{ display: 'flex', flexShrink: 0 }}>
      <Tooltip title="Editar">
        <IconButton size="small" aria-label={`Editar ${p.numero}`} component={Link} to={ruta} state={{ volver }}><EditOutlinedIcon fontSize="small" /></IconButton>
      </Tooltip>
      {p.estado === 'PRESTADA'
        // Borrarla se llevaría el único rastro de quién la tiene: el servidor
        // lo rechaza, y aquí se dice antes el camino. El span deja ver el
        // aviso sobre un botón deshabilitado.
        ? (
          <Tooltip title="Está prestada: regístrala con «Devolver» y, si no va a volver, pásala a «Baja», que conserva su historia.">
            <span><IconButton size="small" disabled aria-label={`Eliminar ${p.numero} (está prestada)`}><DeleteOutlineIcon fontSize="small" /></IconButton></span>
          </Tooltip>
        )
        : (
          <Tooltip title="Eliminar">
            <IconButton size="small" aria-label={`Eliminar ${p.numero}`} onClick={() => onBorrar(p)}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
    </Box>
  )
}
