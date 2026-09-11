import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import type { ResumenContable, Transaction } from '../../../lib/api/accounting'
import type { FiltrosUi } from './filtros'
import { COLOR_GASTO, COLOR_INGRESO, etiquetaMetodo, euros, fechaCorta } from './formato'

interface Props {
  apuntes: Transaction[]
  totales: ResumenContable['totales'] | null
  tipo: FiltrosUi['tipo']
}

const cabeceraImporte = (texto: string, color: string) => (
  <TableCell align="right">
    <Box component="span" aria-hidden="true" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color, mr: 0.75 }} />
    {texto}
  </TableCell>
)

/**
 * El libro de caja: cada importe en su columna, Ingreso o Gasto, sin signos.
 * La marca de color de la izquierda de cada fila repite el tipo de un vistazo.
 */
export default function LibroCaja({ apuntes, totales, tipo }: Props) {
  const verIngreso = tipo !== 'GASTO'
  const verGasto = tipo !== 'INGRESO'
  const columnasTexto = 4

  return (
    <TableContainer component={Paper}>
      {/* Ancho mínimo: en el móvil la tabla se desliza en vez de partir cada concepto en cuatro líneas. */}
      <Table size="small" aria-label="Libro de caja" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', backgroundColor: '#faf8f5', whiteSpace: 'nowrap' } }}>
            <TableCell>Fecha</TableCell>
            <TableCell>Concepto</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell>Método</TableCell>
            {verIngreso && cabeceraImporte('Ingreso', COLOR_INGRESO)}
            {verGasto && cabeceraImporte('Gasto', COLOR_GASTO)}
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
              </TableRow>
            )
          })}
          {apuntes.length === 0 && (
            <TableRow><TableCell colSpan={columnasTexto + 2} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No hay apuntes con estos filtros.</TableCell></TableRow>
          )}
        </TableBody>
        {totales && apuntes.length > 0 && (
          <TableFooter>
            <TableRow sx={{ '& td': { fontWeight: 700, fontSize: 14, color: 'text.primary', backgroundColor: '#faf8f5', whiteSpace: 'nowrap' } }}>
              <TableCell colSpan={columnasTexto}>Total de lo filtrado</TableCell>
              {verIngreso && <TableCell align="right">{euros(totales.ingresos)}</TableCell>}
              {verGasto && <TableCell align="right">{euros(totales.gastos)}</TableCell>}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </TableContainer>
  )
}
