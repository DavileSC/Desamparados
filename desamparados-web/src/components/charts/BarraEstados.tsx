import { Box, Typography } from '@mui/material'
import { designTokens } from '../../theme'

export type EstadoSegmento = 'ok' | 'aviso' | 'error'

export interface Segmento {
  etiqueta: string
  valor: number
  estado: EstadoSegmento
}

interface Props {
  segmentos: Segmento[]
}

export default function BarraEstados({ segmentos }: Props) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0)

  if (total === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const visibles = segmentos.filter((s) => s.valor > 0)
  const resumen = visibles.map((s) => `${s.etiqueta}: ${s.valor}`).join(', ')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
      {/* 2 px de hueco entre segmentos: sin él, dos colores contiguos se leen
          como uno solo cuando el trozo es estrecho. */}
      <Box sx={{ display: 'flex', gap: '2px', height: 26 }} role="img" aria-label={resumen}>
        {visibles.map((s) => (
          <Box
            key={s.etiqueta}
            data-testid="segmento"
            sx={{
              flexGrow: s.valor,
              flexBasis: 0,
              borderRadius: '3px',
              backgroundColor: designTokens.dataviz.estados[s.estado],
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {segmentos.map((s) => (
          <Box key={s.etiqueta} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: '2px',
                backgroundColor: designTokens.dataviz.estados[s.estado],
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {s.etiqueta} {s.valor}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
