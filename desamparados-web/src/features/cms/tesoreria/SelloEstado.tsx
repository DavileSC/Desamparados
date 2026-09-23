import type { ComponentType } from 'react'
import { Box, type SvgIconProps } from '@mui/material'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import type { AdminReceiptStatus } from '../../../lib/api/tesoreria'
import { ESTADOS_RECIBO, tonoDeEstado } from './estados'

const ICONOS: Record<AdminReceiptStatus, ComponentType<SvgIconProps>> = {
  PENDIENTE: ScheduleOutlinedIcon,
  REMESADO: AccountBalanceOutlinedIcon,
  PAGADO: CheckRoundedIcon,
  DEVUELTO: UndoRoundedIcon,
  EXENTO: ShieldOutlinedIcon,
  ANULADO: BlockOutlinedIcon,
}

/** El tono de un estado, en los dos modos a la vez. */
const useTonoEstado = tonoDeEstado

/**
 * El sello de estado de un recibo. Ancho fijo: en una columna, todos los
 * sellos empiezan y acaban en el mismo sitio y se leen de arriba abajo.
 */
export default function SelloEstado({ estado }: { estado: AdminReceiptStatus }) {
  const tono = useTonoEstado(estado)
  const Icono = ICONOS[estado]
  return (
    <Box
      component="span"
      sx={{
        width: 124, height: 26, boxSizing: 'border-box', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', gap: 0.75, pl: 1.125, pr: 1.25,
        borderRadius: 13, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap',
        color: tono.texto, backgroundColor: tono.fondo,
      }}
    >
      <Icono aria-hidden="true" sx={{ fontSize: 15 }} />
      {ESTADOS_RECIBO[estado].etiqueta}
    </Box>
  )
}
