import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import type { Prenda } from '../../../lib/api/inventario'
import { useColoresContabilidad } from '../contabilidad/tema'
import { cabeceraTabla, soloLector } from './tabla'
import { BotonPaso, MenuPrenda, PildoraEstado, prestadaA, type AccionesPrenda } from './piezasPrenda'

interface Props extends AccionesPrenda {
  prendas: Prenda[]
  /** La consulta del listado, para que la edición devuelva a la misma página y filtros. */
  volver: string
}

/**
 * Las prendas de un tipo en el PC, en una sola columna y con títulos: número,
 * talla, estado y quién la tiene, y a la derecha su paso siguiente, editar y
 * eliminar. Las observaciones salen al pasar por encima del número. En el
 * móvil va en fichas (PrendasEnFichas).
 */
export default function TablaPrendas({ prendas, volver, ...acciones }: Props) {
  const { fondoCabecera } = useColoresContabilidad()

  if (prendas.length === 0) {
    return <Paper sx={{ py: 5, px: 2, textAlign: 'center', color: 'text.secondary' }}>No hay prendas con esta búsqueda o estos filtros.</Paper>
  }

  return (
    <TableContainer component={Paper}>
      <Table aria-label="Ropero" sx={{ '& td': { py: 1, fontSize: 14.5 } }}>
        <TableHead>
          <TableRow sx={cabeceraTabla(fondoCabecera)}>
            <TableCell sx={{ width: 130 }}>Número</TableCell>
            <TableCell sx={{ width: 100 }}>Talla</TableCell>
            <TableCell sx={{ width: 170 }}>Estado</TableCell>
            <TableCell>La tiene</TableCell>
            <TableCell sx={{ width: 200 }}><Box component="span" sx={soloLector}>Acciones</Box></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {prendas.map((p) => {
            const quien = prestadaA(p)
            return (
              <TableRow key={p.id} hover>
                <TableCell title={p.observaciones || undefined} sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.numero}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: p.talla ? 'text.primary' : 'text.disabled' }}>{p.talla || '—'}</TableCell>
                <TableCell><PildoraEstado estado={p.estado} /></TableCell>
                <TableCell sx={{ color: quien ? 'text.primary' : 'text.disabled' }}>{quien ?? '—'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    <BotonPaso prenda={p} acciones={acciones} />
                    <MenuPrenda prenda={p} volver={volver} onBorrar={acciones.onBorrar} />
                  </Box>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
