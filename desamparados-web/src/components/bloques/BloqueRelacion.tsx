import { Link } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { esDestinoValido } from '../../lib/destinos'
import { anchoMaximo } from './presentacion'
import type { BloqueRelacion as Datos, FilaDeRelacion } from '../../lib/api/contenido'

/** Oro del primer cargo y del título; el resto de cargos, en un oro más apagado. */
const ORO = '#dec72b'
const ORO_SUAVE = '#c4af79'

/**
 * Relación de un órgano de gobierno: una fila por cargo, con el cargo en
 * versalitas doradas, quien lo ocupa en letra fina y grande, y en una línea lo
 * que hace (o, si tiene página, un enlace a ella). El primer cargo va algo
 * mayor. Arriba, el título con el mandato y, al otro lado, una nota como la
 * fecha del cabildo en que se eligió.
 *
 * Sin nombre, la fila enseña el cargo y su función: la relación se puede
 * publicar antes de tener los nombres. Pinta su propio título.
 */
export default function BloqueRelacion({ bloque }: { bloque: Datos }) {
  const encabezado = [bloque.titulo, bloque.mandato && `Mandato ${bloque.mandato}`].filter(Boolean).join(' · ')
  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, 'none'), mx: 'auto' }}>
      {(encabezado || bloque.nota) && (
        <Box sx={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 1,
          pb: 2.25, borderBottom: '1px solid', borderColor: 'divider',
        }}>
          <Typography component="h2" sx={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: ORO_SUAVE, m: 0 }}>
            {encabezado}
          </Typography>
          {bloque.nota && <Typography component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>{bloque.nota}</Typography>}
        </Box>
      )}
      <Box component="dl" sx={{ m: 0 }}>
        {bloque.filas.map((fila, i) => <Fila key={i} fila={fila} primera={i === 0} />)}
      </Box>
    </Box>
  )
}

function Fila({ fila, primera }: { fila: FilaDeRelacion; primera: boolean }) {
  const conNombre = fila.nombre.trim() !== ''
  const enlace = fila.enlace && esDestinoValido(fila.enlace) ? fila.enlace : ''
  const funcion = fila.texto && (enlace
    ? (
      <Box component={Link} to={enlace} sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1, color: 'text.secondary', textDecoration: 'none', transition: 'color .25s ease',
        '& svg': { fontSize: 16, color: 'secondary.main', transition: 'transform .25s ease' },
        '&:hover': { color: 'text.primary' }, '&:hover svg': { transform: 'translateX(3px)' },
      }}>
        {fila.texto} <ArrowForwardIcon aria-hidden />
      </Box>
    )
    : fila.texto)
  return (
    <Box sx={{
      display: 'grid', alignItems: 'baseline', gap: { xs: 0.75, md: 5 },
      gridTemplateColumns: { xs: '1fr', md: conNombre ? '280px minmax(0, 1fr) minmax(0, 1fr)' : '280px minmax(0, 2fr)' },
      py: { xs: 2.5, md: primera ? 3.75 : 3.25 }, borderBottom: '1px solid', borderColor: 'divider',
      '&:last-of-type': { borderBottom: 0 },
    }}>
      <Typography component="dt" sx={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: primera ? ORO : ORO_SUAVE }}>
        {fila.cargo}
      </Typography>
      {conNombre && (
        <Typography component="dd" sx={{ m: 0, fontSize: primera ? { xs: 26, md: 28 } : { xs: 21, md: 23 }, fontWeight: 300, lineHeight: 1.25, color: 'text.primary' }}>
          {fila.nombre}
        </Typography>
      )}
      {funcion && (
        <Typography component="dd" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: 'text.secondary' }}>{funcion}</Typography>
      )}
    </Box>
  )
}
