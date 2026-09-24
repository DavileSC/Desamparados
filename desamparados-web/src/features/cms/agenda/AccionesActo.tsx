import { useState } from 'react'
import { Button, Divider, IconButton, ListItemIcon, Menu, MenuItem } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { Link } from 'react-router-dom'
import type { ApiEvent } from '../../../lib/api/agenda'

/**
 * Editar un acto y, en el menú, duplicarlo o eliminarlo: lo mismo en la fila
 * de la lista y en el panel del día del calendario.
 */
export default function AccionesActo({ evento, volver, onBorrar }: { evento: ApiEvent; volver: string; onBorrar: () => void }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const cerrar = () => setMenu(null)
  return <>
    <Button
      size="small"
      variant="outlined"
      color="inherit"
      startIcon={<EditOutlinedIcon />}
      component={Link}
      to={`/cms/agenda/${evento.id}/editar`}
      state={{ volver }}
      aria-label={`Editar ${evento.title}`}
      sx={{ whiteSpace: 'nowrap', borderColor: 'divider' }}
    >
      Editar
    </Button>
    <IconButton size="small" aria-label={`Más acciones para ${evento.title}`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}>
      <MoreHorizIcon fontSize="small" />
    </IconButton>
    <Menu anchorEl={menu} open={menu !== null} onClose={cerrar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
      {/* Los ensayos y los cultos de cada semana son casi iguales: se parte de uno y se cambia la fecha. */}
      <MenuItem component={Link} to="/cms/agenda/nuevo" state={{ volver, copiaDe: evento.id }} onClick={cerrar}>
        <ListItemIcon><ContentCopyOutlinedIcon fontSize="small" /></ListItemIcon>Duplicar
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => { cerrar(); onBorrar() }} sx={{ color: 'error.main' }}>
        <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>Eliminar
      </MenuItem>
    </Menu>
  </>
}
