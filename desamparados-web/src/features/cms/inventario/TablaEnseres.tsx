import { Box, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Link } from 'react-router-dom'
import type { Enser } from '../../../lib/api/inventario'
import { useColoresContabilidad } from '../contabilidad/tema'
import { useTonos } from '../listados/tonos'
import { cabeceraTabla, soloLector } from './tabla'
import { Dato, DatosDeFicha, Ficha, ListaDeFichas } from '../listados/Fichas'
import { useEnFichas } from '../listados/useEnFichas'

interface Props {
  enseres: Enser[]
  /** La consulta del listado, para que la edición devuelva a la misma página y filtros. */
  volver: string
  onBorrar: (enser: Enser) => void
}

/**
 * Los enseres como tabla: se recorren, se comparan y se ordenan, así que van
 * en columnas, con el mismo lenguaje que el libro de caja. La conservación es
 * una barra partida en óptimo, bueno y a reparar, con las cifras debajo.
 */
export default function TablaEnseres({ enseres, volver, onBorrar }: Props) {
  const { fondoCabecera, carril } = useColoresContabilidad()
  const { punto } = useTonos()
  const tramos = [
    { clave: 'cantidadOptimo', texto: 'óptimo', color: punto.ok },
    { clave: 'cantidadBueno', texto: 'bueno', color: punto.info },
    { clave: 'cantidadReparar', texto: 'a reparar', color: punto.aviso },
  ] as const
  const enFichas = useEnFichas()

  const conservacion = (e: Enser) => {
    const total = e.cantidadOptimo + e.cantidadBueno + e.cantidadReparar
    const partes = tramos.filter((t) => e[t.clave] > 0)
    return <>
      <Box aria-hidden="true" sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: carril }}>
        {total > 0 && partes.map((t) => <Box key={t.clave} sx={{ width: `${(e[t.clave] / total) * 100}%`, backgroundColor: t.color }} />)}
      </Box>
      <Typography component="span" sx={{ display: 'block', mt: 0.5, fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {partes.length > 0 ? partes.map((t) => `${e[t.clave]} ${t.texto}`).join(' · ') : 'Sin unidades'}
      </Typography>
    </>
  }
  const acciones = (e: Enser) => <>
    <Tooltip title="Editar">
      <IconButton size="small" aria-label={`Editar ${e.nombre}`} component={Link} to={`/cms/inventario/${e.id}/editar`} state={{ volver }}><EditOutlinedIcon fontSize="small" /></IconButton>
    </Tooltip>
    <Tooltip title="Eliminar">
      <IconButton size="small" aria-label={`Eliminar ${e.nombre}`} onClick={() => onBorrar(e)}><DeleteOutlineIcon fontSize="small" /></IconButton>
    </Tooltip>
  </>

  if (enFichas) {
    return (
      <ListaDeFichas etiqueta="Enseres" vacia={enseres.length === 0 ? 'No hay enseres con esta búsqueda o estos filtros.' : undefined}>
        {enseres.map((e) => (
          <Ficha
            key={e.id}
            acciones={acciones(e)}
            titulo={<>
              <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{e.nombre}</Typography>
              {e.referencia && <Typography component="span" sx={{ display: 'block', fontSize: 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{e.referencia}</Typography>}
            </>}
          >
            <DatosDeFicha>
              <Dato etiqueta="Categoría">{e.categoria || '—'}</Dato>
              <Dato etiqueta="Total">{e.cantidadOptimo + e.cantidadBueno + e.cantidadReparar}</Dato>
              <Dato etiqueta="Ubicación" ancho>{e.ubicacion || 'Sin ubicación'}</Dato>
              <Dato etiqueta="Conservación" ancho>{conservacion(e)}</Dato>
            </DatosDeFicha>
          </Ficha>
        ))}
      </ListaDeFichas>
    )
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small" aria-label="Enseres" sx={{ minWidth: 820 }}>
        <TableHead>
          <TableRow sx={cabeceraTabla(fondoCabecera)}>
            <TableCell>Enser</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell>Ubicación</TableCell>
            <TableCell sx={{ width: 230 }}>Conservación</TableCell>
            <TableCell align="right" sx={{ width: 72 }}>Total</TableCell>
            <TableCell padding="none" sx={{ width: 88 }}><Box component="span" sx={soloLector}>Acciones</Box></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {enseres.map((e) => {
            const total = e.cantidadOptimo + e.cantidadBueno + e.cantidadReparar
            return (
              <TableRow key={e.id} hover>
                <TableCell>
                  <Typography component="span" sx={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{e.nombre}</Typography>
                  {e.referencia && <Typography component="span" sx={{ display: 'block', fontSize: 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{e.referencia}</Typography>}
                </TableCell>
                <TableCell sx={{ color: e.categoria ? 'text.primary' : 'text.disabled' }}>{e.categoria || '—'}</TableCell>
                <TableCell sx={{ color: e.ubicacion ? 'text.primary' : 'text.disabled' }}>{e.ubicacion || 'Sin ubicación'}</TableCell>
                <TableCell>{conservacion(e)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{total}</TableCell>
                <TableCell padding="none" align="right" sx={{ whiteSpace: 'nowrap', pr: 1 }}>{acciones(e)}</TableCell>
              </TableRow>
            )
          })}
          {enseres.length === 0 && (
            <TableRow><TableCell colSpan={6} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No hay enseres con esta búsqueda o estos filtros.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      {/* La leyenda de la barra, una vez para toda la tabla. */}
      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', fontSize: 12.5, color: 'text.secondary' }}>
        {tramos.map((t) => (
          <Box key={t.clave} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '2px', backgroundColor: t.color }} />
            {t.texto.charAt(0).toUpperCase() + t.texto.slice(1)}
          </Box>
        ))}
      </Box>
    </TableContainer>
  )
}
