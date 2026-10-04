import type { ReactNode } from 'react'
import { Box, Link as EnlaceMui, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

/** Las piezas de las páginas legales: así todas tienen el mismo tamaño de títulos, aire y enlaces. */

export function Apartado({ titulo, primero = false, children }: { titulo: string; primero?: boolean; children: ReactNode }) {
  return <>
    <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: primero ? 0 : 4 }}>{titulo}</Typography>
    {children}
  </>
}

export function Subapartado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <>
    <Typography component="h3" sx={{ color: 'text.primary', fontWeight: 600, fontSize: 17, mb: 1, mt: 3 }}>{titulo}</Typography>
    {children}
  </>
}

export function P({ children }: { children: ReactNode }) {
  return <Typography component="p" sx={{ mb: 2 }}>{children}</Typography>
}

export function Lista({ children }: { children: ReactNode }) {
  return <Box component="ul" sx={{ mt: 0, mb: 2, pl: 3, '& li': { mb: 0.75 } }}>{children}</Box>
}

/** Un enlace a otra página de la web, en el color de los enlaces del texto. */
export function Enlace({ a, children }: { a: string; children: ReactNode }) {
  return <EnlaceMui component={Link} to={a} sx={{ color: 'secondary.main' }}>{children}</EnlaceMui>
}

/** Un enlace fuera de la web, que se abre aparte. */
export function EnlaceFuera({ a, children }: { a: string; children: ReactNode }) {
  return <EnlaceMui href={a} target="_blank" rel="noopener noreferrer" sx={{ color: 'secondary.main' }}>{children}</EnlaceMui>
}

/**
 * Una tabla legible en el móvil: en pantallas estrechas cada fila pasa a ser
 * una ficha con sus etiquetas, en vez de una tabla que obliga a desplazarse.
 */
export function Tabla({ columnas, filas }: { columnas: string[]; filas: ReactNode[][] }) {
  return (
    <Box component="table" sx={{
      width: '100%', borderCollapse: 'collapse', mb: 3, fontSize: 14.5, lineHeight: 1.55,
      '& th': { textAlign: 'left', color: 'text.primary', fontWeight: 600, p: 1.25, borderBottom: '1px solid', borderColor: 'divider' },
      '& td': { verticalAlign: 'top', p: 1.25, borderBottom: '1px solid', borderColor: 'divider' },
      '& td:first-of-type': { color: 'text.primary', fontWeight: 600, overflowWrap: 'anywhere' },
      '@media (max-width: 699px)': {
        '& thead': { display: 'none' },
        '& tr': { display: 'block', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' },
        '& td': { display: 'block', p: 0, border: 0, mb: 0.5 },
        '& td::before': { content: 'attr(data-etiqueta) ": "', color: 'text.primary', fontWeight: 600 },
        '& td:first-of-type::before': { content: 'none' },
        '& td:first-of-type': { fontSize: 15.5, mb: 0.75 },
      },
    }}>
      <thead><tr>{columnas.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i}>{fila.map((celda, k) => <td key={k} data-etiqueta={columnas[k]}>{celda}</td>)}</tr>
        ))}
      </tbody>
    </Box>
  )
}
