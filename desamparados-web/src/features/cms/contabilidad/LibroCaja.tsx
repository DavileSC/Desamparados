import { Box, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import type { ResumenContable, Transaction } from '../../../lib/api/accounting'
import type { FiltrosUi } from './filtros'
import { COLOR_GASTO, COLOR_INGRESO, etiquetaMetodo, euros, fechaCorta } from './formato'
import { useColoresContabilidad } from './tema'

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
const soloLector = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/**
 * El libro de caja: cada importe en su columna, Ingreso o Gasto, sin signos.
 * La marca de color de la izquierda de cada fila repite el tipo de un vistazo.
 *
 * Los apuntes manuales se corrigen o se borran desde su fila. Los que vienen de
 * un recibo no: se corrigen desde el recibo, en Tesorería, para que el estado
 * del recibo y la contabilidad no se contradigan.
 */
export default function LibroCaja({ apuntes, totales, tipo, onCorregir, onBorrar }: Props) {
  const { fondoCabecera } = useColoresContabilidad()
  const verIngreso = tipo !== 'GASTO'
  const verGasto = tipo !== 'INGRESO'
  const verAcciones = Boolean(onCorregir || onBorrar)
  const columnasTexto = 4
  const columnas = columnasTexto + (verIngreso ? 1 : 0) + (verGasto ? 1 : 0) + (verAcciones ? 1 : 0)

  return (
    <TableContainer component={Paper}>
      {/* Ancho mínimo: en el móvil la tabla se desliza en vez de partir cada concepto en cuatro líneas. */}
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
            const deRecibo = a.reciboId != null
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
                    {deRecibo ? (
                      <Tooltip title="Viene de un recibo: se corrige desde el recibo, en Tesorería">
                        <Box component="span" role="img" tabIndex={0} aria-label="Viene de un recibo: se corrige desde el recibo, en Tesorería" sx={{ display: 'inline-flex', p: 1, color: 'text.disabled' }}>
                          <ReceiptLongOutlinedIcon fontSize="small" />
                        </Box>
                      </Tooltip>
                    ) : <>
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
                    </>}
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
