import { IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import type { Apuntado } from '../../../lib/api/mesa'
import type { Salida } from '../../../lib/api/salidas'
import { useColoresContabilidad } from '../contabilidad/tema'
import { cabeceraTabla } from '../inventario/tabla'
import Pildora from '../listados/Pildora'
import { alturaEnMetros, euros } from './formato'

interface Props {
  apuntados: Apuntado[]
  salida: Salida
  /** De quién es la ficha abierta en el panel, para marcar su fila. */
  seleccionado: number | null
  onElegir: (hermanoId: number) => void
  /** Reimprimir la papeleta de quien ya la recogió (una perdida, una en mal estado). */
  onImprimir: (papeletaId: number) => void
}

const tenue = { color: 'text.disabled' } as const

/** Qué pasó con su cíngulo: el que se le debe salta a la vista. */
function Cingulo({ a }: { a: Apuntado }) {
  switch (a.cingulo) {
    case 'DEBIDO': return <Pildora texto="Se le debe" tono="aviso" />
    case 'PRESTADO': return <>Prestado</>
    case 'DEVUELTO': return <>Devuelto</>
    case 'PROPIO': return <>Propio</>
    case 'NINGUNO': return <>No lleva</>
    default: return <>—</>
  }
}

/** En qué punto está: con algo por pagar, listo para recoger o ya recogido. */
function Estado({ a }: { a: Apuntado }) {
  if (a.estado === 'recogida') return <Pildora texto="Recogida" tono="neutro" />
  if (a.estado === 'lista') return <Pildora texto="Lista" tono="ok" />
  return <Pildora texto={a.pendiente > 0 ? `Debe ${euros(a.pendiente)}` : 'Por pagar'} tono="aviso" />
}

/**
 * Los apuntados como la hoja de siempre: nombre, apellidos, puesto, talla,
 * túnica, capirote o faraona y cíngulo, y en qué punto está cada uno. La
 * fecha de nacimiento y el teléfono están en su ficha: al pulsar una fila se
 * abre la persona en el panel. En una salida sin ropa se va de traje: sin esas columnas.
 */
export default function TablaApuntados({ apuntados, salida, seleccionado, onElegir, onImprimir }: Props) {
  const { fondoCabecera } = useColoresContabilidad()
  const conRopa = salida.conRopa
  const columnas = conRopa ? 8 : 5
  return (
    <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 300px)', minHeight: 320 }}>
      <Table size="small" stickyHeader aria-label="Apuntados" sx={{ minWidth: conRopa ? 880 : 560, '& td': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          {/* La cabecera se queda fija al bajar: su tinte es translúcido en oscuro, así que va sobre el color de la tarjeta para tapar las filas. */}
          <TableRow sx={{ ...cabeceraTabla(fondoCabecera), '& th': { ...cabeceraTabla(fondoCabecera)['& th'], backgroundColor: 'background.paper', backgroundImage: `linear-gradient(${fondoCabecera}, ${fondoCabecera})` } }}>
            <TableCell>Nombre</TableCell>
            <TableCell>Apellidos</TableCell>
            <TableCell>Puesto</TableCell>
            <TableCell align="right">Talla</TableCell>
            {conRopa && <TableCell>Túnica</TableCell>}
            {conRopa && <TableCell>Capirote / faraona</TableCell>}
            {conRopa && <TableCell>Cíngulo</TableCell>}
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
                <TableCell>{a.puesto}{a.puestoPedido && a.puestoPedido !== a.puesto ? <Typography component="span" variant="body2" color="text.secondary"> (pidió {a.puestoPedido})</Typography> : null}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', ...(!a.hermano.alturaHombro && tenue) }}>{a.hermano.alturaHombro ? alturaEnMetros(a.hermano.alturaHombro) : '—'}</TableCell>
                {conRopa && <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!tunica && tenue) }}>{tunica || '—'}</TableCell>}
                {conRopa && <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!tocado && tenue) }}>{tocado || '—'}</TableCell>}
                {conRopa && <TableCell sx={!a.cingulo ? tenue : undefined}><Cingulo a={a} /></TableCell>}
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Estado a={a} />
                    {a.tipo === 'papeleta' && (
                      <Tooltip title="Imprimir la papeleta">
                        {/* La fila abre la ficha: el clic del botón no debe llegar a ella. */}
                        <IconButton
                          size="small"
                          aria-label={`Imprimir la papeleta de ${a.hermano.nombre} ${a.hermano.apellidos}`}
                          onClick={(e) => { e.stopPropagation(); onImprimir(a.id) }}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <PrintOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
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
