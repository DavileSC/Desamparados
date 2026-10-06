import { Box, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import { Link } from 'react-router-dom'
import type { ResumenContable, Transaction } from '../../../lib/api/contabilidad'
import type { FiltrosUi } from './filtros'
import { COLOR_GASTO, COLOR_INGRESO, etiquetaMetodo, euros, fechaCorta } from './formato'
import { useColoresContabilidad } from './tema'
import { useModulos } from '../../../hooks/useModulos'
import { Dato, DatosDeFicha, Ficha, ListaDeFichas } from '../listados/Fichas'
import { useEnFichas } from '../listados/useEnFichas'

interface Props {
  apuntes: Transaction[]
  totales: ResumenContable['totales'] | null
  tipo: FiltrosUi['tipo']
  /** Corregir un apunte manual. Sin estas dos, el libro es de solo lectura. */
  onCorregir?: (apunte: Transaction) => void
  onBorrar?: (apunte: Transaction) => void
}

const cabeceraImporte = (texto: string, color: string) => (
  <TableCell align="right">
    <Box component="span" aria-hidden="true" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color, mr: 0.75 }} />
    {texto}
  </TableCell>
)

// Texto solo para el lector de pantalla: la columna de acciones no necesita título a la vista.
const soloLector = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/**
 * El libro de caja: cada importe en su columna, Ingreso o Gasto, sin signos.
 * La marca de color de la izquierda de cada fila repite el tipo de un vistazo.
 *
 * Los apuntes manuales se corrigen o se borran desde su fila. Los que vienen de
 * un recibo no: se corrigen desde el recibo, en Tesorería, para que el estado
 * del recibo y la contabilidad no se contradigan.
 */
/** Lo que se hace con un apunte, igual en la tabla y en las fichas. */
function AccionesApunte({ apunte: a, onCorregir, onBorrar }: { apunte: Transaction } & Pick<Props, 'onCorregir' | 'onBorrar'>) {
  // Los apuntes de la caja o de la lotería se corrigen allí: con el módulo
  // apagado no hay a dónde llevar, y tampoco se corrigen desde aquí.
  const { activo } = useModulos()
  const deRecibo = a.reciboId != null
  const sorteo = a.talonarioLoteria?.sorteoId ?? a.compraDeLoteria?.id ?? null
  const deCaja = a.ventaDeCaja != null
  return deRecibo ? (
    // Se corrige desde el recibo: el enlace lleva a él, en Tesorería.
    <Tooltip title={`Viene del recibo #${a.reciboId}: se corrige desde Tesorería`}>
      <IconButton size="small" component={Link} to={`/cms/tesoreria?recibo=${a.reciboId}`} aria-label={`Abrir el recibo #${a.reciboId} en Tesorería`}>
        <ReceiptLongOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  ) : deCaja ? (activo('tienda') && (
    <Tooltip title="Es una venta en mano de la tienda: se anula desde Tienda → «Venta en mano»">
      <IconButton size="small" component={Link} to="/cms/tienda?vista=mano" aria-label="Abrir la venta en mano de la tienda">
        <StorefrontOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )) : sorteo !== null ? (activo('loteria') && (
    <Tooltip title="Viene de la lotería: se corrige desde Lotería">
      <IconButton size="small" component={Link} to={`/cms/loteria?sorteo=${sorteo}`} aria-label="Abrir el sorteo en Lotería">
        <ConfirmationNumberOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )) : <>
    {onCorregir && (
      <Tooltip title="Corregir">
        <IconButton size="small" aria-label={`Corregir «${a.concepto}»`} onClick={() => onCorregir(a)}><EditOutlinedIcon fontSize="small" /></IconButton>
      </Tooltip>
    )}
    {onBorrar && (
      <Tooltip title="Borrar">
        <IconButton size="small" aria-label={`Borrar «${a.concepto}»`} onClick={() => onBorrar(a)}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </Tooltip>
    )}
  </>
}

export default function LibroCaja({ apuntes, totales, tipo, onCorregir, onBorrar }: Props) {
  const { fondoCabecera } = useColoresContabilidad()
  const enFichas = useEnFichas()
  const verIngreso = tipo !== 'GASTO'
  const verGasto = tipo !== 'INGRESO'
  const verAcciones = Boolean(onCorregir || onBorrar)
  const columnasTexto = 4
  const columnas = columnasTexto + (verIngreso ? 1 : 0) + (verGasto ? 1 : 0) + (verAcciones ? 1 : 0)

  if (enFichas) {
    return (
      <ListaDeFichas
        etiqueta="Libro de caja"
        vacia={apuntes.length === 0 ? 'No hay apuntes con estos filtros.' : undefined}
        pie={totales && apuntes.length > 0 && (
          <Box sx={{ display: 'grid', gap: 0.5, px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', backgroundColor: fondoCabecera, fontSize: 14 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Total de lo filtrado</Typography>
            <DatosDeFicha>
              {verIngreso && <Dato etiqueta="Ingresos">{euros(totales.ingresos)}</Dato>}
              {verGasto && <Dato etiqueta="Gastos">{euros(totales.gastos)}</Dato>}
            </DatosDeFicha>
          </Box>
        )}
      >
        {apuntes.map((a) => (
          <Ficha
            key={a.id}
            color={a.tipo === 'INGRESO' ? COLOR_INGRESO : COLOR_GASTO}
            acciones={verAcciones ? <AccionesApunte apunte={a} onCorregir={onCorregir} onBorrar={onBorrar} /> : undefined}
            titulo={<>
              <Typography component="span" sx={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{a.concepto}</Typography>
              {a.hermano && <Typography component="span" sx={{ display: 'block', fontSize: 12.5, color: 'text.secondary' }}>{a.hermano.nombre} {a.hermano.apellidos}</Typography>}
            </>}
          >
            <DatosDeFicha>
              <Dato etiqueta={a.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'}>
                <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{euros(Number(a.importe))}</Box>
              </Dato>
              <Dato etiqueta="Fecha">{fechaCorta(a.fecha)}</Dato>
              <Dato etiqueta="Categoría">{a.categoria.nombre}</Dato>
              <Dato etiqueta="Método">{etiquetaMetodo(a.metodoPago)}</Dato>
            </DatosDeFicha>
          </Ficha>
        ))}
      </ListaDeFichas>
    )
  }

  return (
    <TableContainer component={Paper}>
      {/* Ancho mínimo: entre la tableta y el portátil la tabla se desliza en vez de partir cada concepto en cuatro líneas. */}
      <Table size="small" aria-label="Libro de caja" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', backgroundColor: fondoCabecera, whiteSpace: 'nowrap' } }}>
            <TableCell>Fecha</TableCell>
            <TableCell>Concepto</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell>Método</TableCell>
            {verIngreso && cabeceraImporte('Ingreso', COLOR_INGRESO)}
            {verGasto && cabeceraImporte('Gasto', COLOR_GASTO)}
            {verAcciones && <TableCell padding="none" sx={{ width: 88 }}><Box component="span" sx={soloLector}>Acciones</Box></TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {apuntes.map((a) => {
            const color = a.tipo === 'INGRESO' ? COLOR_INGRESO : COLOR_GASTO
            const importe = <Typography component="span" sx={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{euros(Number(a.importe))}</Typography>
            return (
              <TableRow key={a.id} hover sx={{ '& td': { verticalAlign: 'top' }, '& td:first-of-type': { boxShadow: `inset 4px 0 0 ${color}` } }}>
                <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{fechaCorta(a.fecha)}</TableCell>
                <TableCell>
                  {a.concepto}
                  {a.hermano && <Typography component="span" sx={{ display: 'block', fontSize: 12.5, color: 'text.secondary' }}>{a.hermano.nombre} {a.hermano.apellidos}</Typography>}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Box component="span" aria-hidden="true" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '2px', backgroundColor: color, mr: 0.75, verticalAlign: 1 }} />
                  {a.categoria.nombre}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{etiquetaMetodo(a.metodoPago)}</TableCell>
                {verIngreso && <TableCell align="right">{a.tipo === 'INGRESO' ? importe : null}</TableCell>}
                {verGasto && <TableCell align="right">{a.tipo === 'GASTO' ? importe : null}</TableCell>}
                {verAcciones && (
                  <TableCell padding="none" align="right" sx={{ whiteSpace: 'nowrap', pr: 1, py: 0.25 }}>
                    <AccionesApunte apunte={a} onCorregir={onCorregir} onBorrar={onBorrar} />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
          {apuntes.length === 0 && (
            <TableRow><TableCell colSpan={columnas} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No hay apuntes con estos filtros.</TableCell></TableRow>
          )}
        </TableBody>
        {totales && apuntes.length > 0 && (
          <TableFooter>
            <TableRow sx={{ '& td': { fontWeight: 700, fontSize: 14, color: 'text.primary', backgroundColor: fondoCabecera, whiteSpace: 'nowrap' } }}>
              <TableCell colSpan={columnasTexto}>Total de lo filtrado</TableCell>
              {verIngreso && <TableCell align="right">{euros(totales.ingresos)}</TableCell>}
              {verGasto && <TableCell align="right">{euros(totales.gastos)}</TableCell>}
              {verAcciones && <TableCell />}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </TableContainer>
  )
}
