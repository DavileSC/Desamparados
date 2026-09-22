import { Box, Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Link } from 'react-router-dom'
import type { Prenda } from '../../../lib/api/inventario'
import { useColoresContabilidad } from '../contabilidad/tema'
import Pildora from '../listados/Pildora'
import type { TonoPildora } from '../listados/tonos'
import { ETIQUETA_ESTADO, ETIQUETA_TIPO } from '../ropero'
import { cabeceraTabla, soloLector } from './tabla'

interface Props {
  prendas: Prenda[]
  volver: string
  onPrestar: (prenda: Prenda) => void
  onDevolver: (prenda: Prenda) => void
  onBorrar: (prenda: Prenda) => void
}

const TONO_ESTADO: Record<Prenda['estado'], TonoPildora> = {
  DISPONIBLE: 'ok',
  PRESTADA: 'info',
  TALLER: 'aviso',
  BAJA: 'neutro',
}

/**
 * El ropero como tabla: número, tipo, talla, estado y a quién está prestada.
 * Prestar y devolver son la razón de estar en esta pantalla, así que van
 * siempre a la vista y con su palabra; editar y eliminar, con icono.
 */
export default function TablaPrendas({ prendas, volver, onPrestar, onDevolver, onBorrar }: Props) {
  const { fondoCabecera } = useColoresContabilidad()
  return (
    <TableContainer component={Paper}>
      <Table size="small" aria-label="Ropero" sx={{ minWidth: 820 }}>
        <TableHead>
          <TableRow sx={cabeceraTabla(fondoCabecera)}>
            <TableCell align="right" sx={{ width: 96 }}>N.º</TableCell>
            <TableCell sx={{ width: 130 }}>Tipo</TableCell>
            <TableCell sx={{ width: 90 }}>Talla</TableCell>
            <TableCell sx={{ width: 150 }}>Estado</TableCell>
            <TableCell>Prestada a</TableCell>
            <TableCell padding="none" sx={{ width: 200 }}><Box component="span" sx={soloLector}>Acciones</Box></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {prendas.map((p) => (
            <TableRow key={p.id} hover>
              <TableCell align="right" sx={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.numero}</TableCell>
              <TableCell>{ETIQUETA_TIPO[p.tipo] ?? p.tipo}</TableCell>
              <TableCell sx={{ color: p.talla ? 'text.primary' : 'text.disabled' }}>{p.talla || '—'}</TableCell>
              <TableCell><Pildora texto={ETIQUETA_ESTADO[p.estado] ?? p.estado} tono={TONO_ESTADO[p.estado] ?? 'neutro'} /></TableCell>
              <TableCell sx={{ color: p.hermano ? 'text.primary' : 'text.disabled' }}>
                {p.hermano
                  ? `${p.hermano.apellidos}, ${p.hermano.nombre}${p.hermano.numeroHermano ? ` (n.º ${p.hermano.numeroHermano})` : ''}`
                  : '—'}
              </TableCell>
              <TableCell padding="none" align="right" sx={{ whiteSpace: 'nowrap', pr: 1 }}>
                {p.estado === 'DISPONIBLE' && <Button size="small" aria-label={`Prestar ${p.numero}`} onClick={() => onPrestar(p)} sx={{ mr: 0.5 }}>Prestar</Button>}
                {p.estado === 'PRESTADA' && <Button size="small" color="inherit" aria-label={`Devolver ${p.numero}`} onClick={() => onDevolver(p)} sx={{ mr: 0.5 }}>Devolver</Button>}
                <Tooltip title="Editar">
                  <IconButton size="small" aria-label={`Editar ${p.numero}`} component={Link} to={`/cms/inventario/${p.id}/editar?tipo=prenda`} state={{ volver }}><EditOutlinedIcon fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" aria-label={`Eliminar ${p.numero}`} onClick={() => onBorrar(p)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {prendas.length === 0 && (
            <TableRow><TableCell colSpan={6} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No hay prendas con esta búsqueda o estos filtros.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
