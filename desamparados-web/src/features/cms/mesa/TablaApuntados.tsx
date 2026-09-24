import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import type { Apuntado, Salida } from '../../../lib/api/mesa'
import { useColoresContabilidad } from '../contabilidad/tema'
import { cabeceraTabla } from '../inventario/tabla'
import Pildora from '../listados/Pildora'
import { alturaEnMetros, euros, fechaCorta } from './formato'

interface Props {
  apuntados: Apuntado[]
  salida: Salida
  /** De quién es la ficha abierta en el panel, para marcar su fila. */
  seleccionado: number | null
  onElegir: (hermanoId: number) => void
}

const tenue = { color: 'text.disabled' } as const

/** En qué punto está: con algo por pagar, listo para recoger o ya recogido. */
function Estado({ a }: { a: Apuntado }) {
  if (a.estado === 'recogida') return <Pildora texto="Recogida" tono="neutro" />
  if (a.estado === 'lista') return <Pildora texto="Lista" tono="ok" />
  return <Pildora texto={a.pendiente > 0 ? `Debe ${euros(a.pendiente)}` : 'Por pagar'} tono="aviso" />
}

/**
 * Los apuntados como la hoja de siempre: nombre, apellidos, fecha de
 * nacimiento, teléfono, puesto, talla, túnica y capirote o faraona, y en qué
 * punto está cada uno. Al pulsar una fila se abre la persona en el panel
 * para corregirla. En el Rosario, sin ropa: se va de traje.
 */
export default function TablaApuntados({ apuntados, salida, seleccionado, onElegir }: Props) {
  const { fondoCabecera } = useColoresContabilidad()
  const conRopa = salida === 'PASION'
  const columnas = conRopa ? 9 : 7
  return (
    <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 300px)', minHeight: 320 }}>
      <Table size="small" stickyHeader aria-label="Apuntados" sx={{ minWidth: conRopa ? 980 : 760, '& td': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={cabeceraTabla(fondoCabecera)}>
            <TableCell>Nombre</TableCell>
            <TableCell>Apellidos</TableCell>
            <TableCell>Nacimiento</TableCell>
            <TableCell>Teléfono</TableCell>
            <TableCell>Puesto</TableCell>
            <TableCell align="right">Talla</TableCell>
            {conRopa && <TableCell>Túnica</TableCell>}
            {conRopa && <TableCell>Capirote / faraona</TableCell>}
            <TableCell>Estado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {apuntados.map((a) => {
            const tunica = a.origenTunica === 'PROPIA' ? 'Propia' : a.origenTunica === 'NINGUNA' ? 'No lleva' : a.numTunicaAsignada
            const tocado = a.numCapiroteAsignado ?? (a.numFaraonaAsignada && `${a.numFaraonaAsignada} (faraona)`)
            return (
              <TableRow
                key={`${a.tipo}-${a.id}`}
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
                <TableCell>{a.puesto}{a.puestoPedido && a.puestoPedido !== a.puesto ? <Typography component="span" variant="body2" color="text.secondary"> (pidió {a.puestoPedido})</Typography> : null}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', ...(!a.hermano.alturaHombro && tenue) }}>{a.hermano.alturaHombro ? alturaEnMetros(a.hermano.alturaHombro) : '—'}</TableCell>
                {conRopa && <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!tunica && tenue) }}>{tunica || '—'}</TableCell>}
                {conRopa && <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!tocado && tenue) }}>{tocado || '—'}</TableCell>}
                <TableCell><Estado a={a} /></TableCell>
              </TableRow>
            )
          })}
          {apuntados.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnas} sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">Todavía no hay nadie apuntado con esta búsqueda.</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
