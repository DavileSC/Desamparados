import { Box, Typography } from '@mui/material'
import { designTokens } from '../../theme'

export interface FilaBarra {
  etiqueta: string
  valor: number
}

interface Props {
  filas: FilaBarra[]
  color?: string
}

/**
 * Una sola serie, así que un solo color: el orden y la longitud ya distinguen
 * las filas. Pintarlas de colores distintos sugeriría categorías que no hay.
 */
export default function BarrasHorizontales({ filas, color }: Props) {
  if (filas.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const relleno = color ?? designTokens.dataviz.series[0]
  const max = Math.max(...filas.map((f) => f.valor))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
      {filas.map((fila) => (
        <Box
          key={fila.etiqueta}
          sx={{ display: 'grid', gridTemplateColumns: '128px 1fr auto', alignItems: 'center', gap: 1.5 }}
        >
          <Typography variant="body2" color="text.secondary" noWrap title={fila.etiqueta}>
            {fila.etiqueta}
          </Typography>
          <Box sx={{ height: 9, borderRadius: 99, backgroundColor: 'divider', overflow: 'hidden' }}>
            <Box
              data-testid="barra"
              sx={{
                height: '100%',
                borderRadius: 99,
                backgroundColor: relleno,
                // Sin datos, max es 0: la división daría NaN.
                width: `${max > 0 ? (fila.valor / max) * 100 : 0}%`,
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fila.valor}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
