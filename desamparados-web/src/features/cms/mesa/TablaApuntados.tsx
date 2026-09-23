import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import type { Apuntado } from '../../../lib/api/mesa'
import { useColoresContabilidad } from '../contabilidad/tema'
import { cabeceraTabla } from '../inventario/tabla'
import { NOMBRE_METODO, alturaEnMetros, euros, fechaCorta } from './formato'

interface Props {
  apuntados: Apuntado[]
  /** De quién es la ficha abierta en el panel, para marcar su fila. */
  seleccionado: number | null
  onElegir: (hermanoId: number) => void
}

const tenue = { color: 'text.disabled' } as const

/**
 * Los apuntados del año como la hoja de siempre: nombre, apellidos, fecha de
 * nacimiento, teléfono, puesto, talla, túnica y capirote o faraona, y lo
 * cobrado. Al pulsar una fila se abre la persona en el panel para corregirla.
 */
export default function TablaApuntados({ apuntados, seleccionado, onElegir }: Props) {
  const { fondoCabecera } = useColoresContabilidad()
  return (
    <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 260px)', minHeight: 320 }}>
      <Table size="small" stickyHeader aria-label="Apuntados" sx={{ minWidth: 980, '& td': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={cabeceraTabla(fondoCabecera)}>
            <TableCell>Nombre</TableCell>
            <TableCell>Apellidos</TableCell>
            <TableCell>Nacimiento</TableCell>
            <TableCell>Teléfono</TableCell>
            <TableCell>Puesto</TableCell>
            <TableCell align="right">Talla</TableCell>
            <TableCell>Túnica</TableCell>
            <TableCell>Capirote / faraona</TableCell>
            <TableCell align="right">Cobro</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {apuntados.map((a) => {
            const tunica = a.origenTunica === 'PROPIA' ? 'Propia' : a.origenTunica === 'NINGUNA' ? 'No lleva' : a.numTunicaAsignada
            const tocado = a.numCapiroteAsignado ?? (a.numFaraonaAsignada && `${a.numFaraonaAsignada} (faraona)`)
            return (
              <TableRow
                key={a.id}
                hover
                selected={a.hermano.id === seleccionado}
                onClick={() => onElegir(a.hermano.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onElegir(a.hermano.id) } }}
                tabIndex={0}
                aria-label={`Abrir a ${a.hermano.nombre} ${a.hermano.apellidos}`}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{a.hermano.nombre}</TableCell>
                <TableCell>{a.hermano.apellidos}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{fechaCorta(a.hermano.fechaNacimiento)}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!a.hermano.telefono && tenue) }}>{a.hermano.telefono ?? '—'}</TableCell>
                <TableCell>{a.puesto}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', ...(!a.hermano.alturaHombro && tenue) }}>{a.hermano.alturaHombro ? alturaEnMetros(a.hermano.alturaHombro) : '—'}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!tunica && tenue) }}>{tunica || '—'}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!tocado && tenue) }}>{tocado || '—'}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {a.recibo.importe === 0 ? 'Sin cobro' : euros(a.recibo.importe)}
                  {a.recibo.metodoPago && <Box component="span" sx={{ color: 'text.secondary', ml: 0.75, fontSize: 12.5 }}>{NOMBRE_METODO[a.recibo.metodoPago]}</Box>}
                </TableCell>
              </TableRow>
            )
          })}
          {apuntados.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">Todavía no hay nadie apuntado con esta búsqueda.</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
