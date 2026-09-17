import { Box, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import type { GraficasCms } from '../../theme/cms'

export type ClaveEstado = 'ok' | 'aviso' | 'error'

export interface FilaEstado {
  clave: string
  etiqueta: string
  total: number
  importe: number
  estado: ClaveEstado
}

interface Props {
  estados: FilaEstado[]
  paleta: GraficasCms
  formatoImporte: (valor: number) => string
  /** Con el mismo punto de miles que la tabla: los componentes de `charts/`
   * no dependen de `features/`, así que el formato llega por props. */
  formatoNumero: (valor: number) => string
}

const ICONO = {
  ok: CheckCircleOutlineIcon,
  aviso: ScheduleIcon,
  error: ReportProblemOutlinedIcon,
}

/**
 * Cuánto se ha cobrado y de qué se compone el resto. El verde y el ámbar no
 * llegan a 3:1 sobre el lienzo claro, así que cada estado lleva además icono,
 * texto, número e importe: el color solo acompaña.
 */
export default function ProporcionEstados({ estados, paleta, formatoImporte, formatoNumero }: Props) {
  const total = estados.reduce((s, e) => s + e.total, 0)

  if (total === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const cobrados = estados.filter((e) => e.estado === 'ok').reduce((s, e) => s + e.total, 0)
  const porcentaje = Math.round((cobrados / total) * 100)
  const visibles = estados.filter((e) => e.total > 0)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap' }}>
        <Typography component="span" sx={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {porcentaje} %
        </Typography>
        <Typography variant="body2" color="text.secondary">
          cobrado · {formatoNumero(cobrados)} de {formatoNumero(total)} recibos
        </Typography>
      </Box>

      {/* 2 px de hueco entre segmentos: sin él, dos colores contiguos se leen
          como uno solo cuando el trozo es estrecho. */}
      <Box sx={{ display: 'flex', gap: '2px', height: 14, borderRadius: '7px', overflow: 'hidden', my: 2 }} aria-hidden="true">
        {visibles.map((e) => (
          <Box
            key={e.clave}
            data-testid="segmento"
            sx={{ flexGrow: e.total, flexBasis: 0, minWidth: 6, backgroundColor: paleta.estados[e.estado] }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto auto', rowGap: 1.25, columnGap: 1.25, alignItems: 'center', fontSize: 14 }}>
        {estados.map((e) => {
          const Icono = ICONO[e.estado]
          return (
            <Box key={e.clave} sx={{ display: 'contents' }}>
              <Box sx={{ display: 'flex', color: paleta.estados[e.estado] }}><Icono sx={{ fontSize: 18 }} /></Box>
              <Typography variant="body2" color="text.secondary">{e.etiqueta}</Typography>
              <Typography component="strong" variant="body2" sx={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatoNumero(e.total)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatoImporte(e.importe)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
