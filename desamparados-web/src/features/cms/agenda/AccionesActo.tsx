import { useState } from 'react'
import { Box, Button, Divider, IconButton, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material'
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
  // Borrarlo dejaría a la salida sin fecha: se cambia desde su ficha.
  const porQueNoSeBorra = evento.salidaEnlazada
    ? `Es la fecha de la salida «${evento.salidaEnlazada.nombre}»: cámbiala desde la ficha de la salida`
    : null
  return <>
    <Button
      size="small"
      variant="outlined"
      color="inherit"
      startIcon={<EditOutlinedIcon />}
      component={Link}
      to={`/cms/agenda/${evento.id}/editar`}
      // La ficha del acto no sabe de qué salida es (la API no lo dice al
      // cargar uno): se lo cuenta el listado, para bloquear antes de guardar
      // lo que el servidor rechazaría con un 409.
      state={{ volver, salidaEnlazada: evento.salidaEnlazada ?? null }}
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
      {porQueNoSeBorra ? (
        // El servidor ya lo rechaza; deshabilitado se ve antes de pulsar. Un
        // elemento deshabilitado no recibe el ratón, así que el porqué lo
        // enseña la caja de alrededor. Solo entonces va envuelto: la lista del
        // menú no baja a buscar dentro de una caja, y la opción habilitada
        // dejaría de alcanzarse con las flechas.
        <Tooltip title={porQueNoSeBorra} placement="left" describeChild>
          <Box component="li" role="none">
            <MenuItem component="div" disabled sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>Eliminar
            </MenuItem>
          </Box>
        </Tooltip>
      ) : (
        <MenuItem onClick={() => { cerrar(); onBorrar() }} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>Eliminar
        </MenuItem>
      )}
    </Menu>
  </>
}
