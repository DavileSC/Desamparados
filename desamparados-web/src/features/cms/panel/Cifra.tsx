import { Paper, Typography } from '@mui/material'

interface Props {
  etiqueta: string
  valor: string | number
  pie?: string
}

/** Una cifra grande con su etiqueta y, opcionalmente, un pie de contexto. */
export default function Cifra({ etiqueta, valor, pie }: Props) {
  return (
    <Paper sx={{ p: 2, borderTop: 3, borderTopColor: 'primary.main', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="overline" color="text.secondary">{etiqueta}</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 600, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
      {pie && <Typography variant="caption" color="text.secondary">{pie}</Typography>}
    </Paper>
  )
}
