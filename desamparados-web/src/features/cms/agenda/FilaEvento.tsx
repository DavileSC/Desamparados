import { useState, type ReactNode } from 'react'
import { Box, Button, Divider, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Link } from 'react-router-dom'
import { useTemaCms } from '../../../app/useTemaCms'
import type { ApiEvent } from '../../../lib/api/agenda'
import PuntoTipo from './PuntoTipo'
import { rejillaEvento } from './rejilla'
import { diaSemana, hora, finEnOtroDia } from './fechas'

interface Props {
  evento: ApiEvent
  /** Sale ahora en la lista de la portada de la web. */
  enPortada: boolean
  /** La consulta del listado, para que la ficha devuelva a la misma página y filtros. */
  volver: string
  onBorrar: () => void
}

/**
 * Un acto de la agenda: el día como en la agenda de la portada, el título con
 * la hora y el lugar, el tipo, quién lo ve y las acciones. Avisa de lo que en
 * la web se nota: sin lugar, la línea bajo el título se queda en la hora; sin
 * descripción, al abrir el acto en la portada no sale nada.
 */
export default function FilaEvento({ evento, enPortada, volver, onBorrar }: Props) {
  const { superficies } = useTemaCms()
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const cerrar = () => setMenu(null)
  const inicio = new Date(evento.startDate)
  const fin = finEnOtroDia(evento)
  const soloHermanos = evento.visibility === 'members_only'
  const avisos = [!evento.location?.trim() && 'Sin lugar', !evento.description?.trim() && 'Sin descripción'].filter(Boolean) as string[]

  return (
    <Box component="li" sx={{ ...rejillaEvento, px: { xs: 2, md: 2.5 }, py: 1.5, borderTop: 1, borderColor: 'divider', listStyle: 'none' }}>
      {/* En el móvil la fila crece hacia abajo con el tipo y los botones: el día, arriba, junto al título. */}
      <Box sx={{ gridArea: 'dia', alignSelf: { xs: 'start', md: 'center' }, pt: { xs: 0.25, md: 0 }, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        <Box sx={{ fontSize: fin ? 16 : 24, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', color: superficies.enlace }}>
          {fin ? `${inicio.getDate()}–${fin.getDate()}` : inicio.getDate()}
        </Box>
        <Box sx={{ mt: 0.5, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {fin ? `${diaSemana(inicio)}–${diaSemana(fin)}` : diaSemana(inicio)}
        </Box>
      </Box>

      <Box sx={{ gridArea: 'texto', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{evento.title}</Typography>
          {enPortada && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, fontWeight: 600, color: superficies.enlace, whiteSpace: 'nowrap', '& svg': { fontSize: 15, alignSelf: 'center' } }}>
              <HomeOutlinedIcon aria-hidden="true" />En portada
            </Box>
          )}
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[hora(inicio), evento.location?.trim()].filter(Boolean).join(' · ')}
        </Typography>
        {avisos.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
            {avisos.map((texto) => <Aviso key={texto}>{texto}</Aviso>)}
          </Box>
        )}
        {/* En el móvil no hay columnas de tipo y de quién lo ve: van aquí. */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mt: 0.75, flexWrap: 'wrap' }}>
          <PuntoTipo tipo={evento.type} />
          <Quien soloHermanos={soloHermanos} />
        </Box>
      </Box>

      <Box sx={{ gridArea: 'tipo', display: { xs: 'none', md: 'block' } }}><PuntoTipo tipo={evento.type} /></Box>
      <Box sx={{ gridArea: 'quien', display: { xs: 'none', md: 'block' } }}><Quien soloHermanos={soloHermanos} /></Box>

      <Box sx={{ gridArea: 'acciones', display: 'flex', gap: 0.5, justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center' }}>
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
      </Box>
    </Box>
  )
}

/** Público o solo para hermanos. Lo público no lleva marca: es lo normal. */
function Quien({ soloHermanos }: { soloHermanos: boolean }) {
  const { superficies } = useTemaCms()
  if (!soloHermanos) return <Typography variant="body2" sx={{ fontSize: 13.5, color: 'text.secondary' }}>Público</Typography>
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 24, px: 1.25, borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: superficies.pillPendiente, '& svg': { fontSize: 14 } }}>
      <LockOutlinedIcon aria-hidden="true" />Solo hermanos
    </Box>
  )
}

function Aviso({ children }: { children: ReactNode }) {
  const { superficies } = useTemaCms()
  return (
    <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: superficies.avisoTexto, fontWeight: 500, '& svg': { fontSize: 14 } }}>
      <WarningAmberIcon aria-hidden="true" />{children}
    </Typography>
  )
}
