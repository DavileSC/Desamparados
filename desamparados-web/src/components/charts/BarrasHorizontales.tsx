import { Box, Typography } from '@mui/material'
import { designTokens } from '../../theme'

export interface FilaBarra {
  etiqueta: string
  valor: number
}

interface Props {
  filas: FilaBarra[]
  color?: string
  /** Por defecto, el número tal cual; con euros, el importe formateado. */
  formatoValor?: (valor: number) => string
}

/**
 * Una sola serie, así que un solo color: el orden y la longitud ya distinguen
 * las filas. Pintarlas de colores distintos sugeriría categorías que no hay.
 */
export default function BarrasHorizontales({ filas, color, formatoValor }: Props) {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {filas.map((fila) => (
        <Box
          key={fila.etiqueta}
          // La columna del nombre se encoge con la tarjeta: con 176 px fijos,
          // en media tarjeta la barra se quedaba sin sitio.
          sx={{ display: 'grid', gridTemplateColumns: 'minmax(72px, 150px) minmax(0, 1fr) auto', alignItems: 'center', gap: 1.25 }}
        >
          <Typography variant="body2" color="text.secondary" noWrap title={fila.etiqueta}>
            {fila.etiqueta}
          </Typography>
          <Box sx={{ height: 10, borderRadius: 99, backgroundColor: 'divider', overflow: 'hidden' }}>
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
          <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {formatoValor ? formatoValor(fila.valor) : fila.valor}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
