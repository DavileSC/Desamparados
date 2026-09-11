import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import type { ResumenContable, TipoApunte } from '../../../lib/api/accounting'
import type { FiltrosUi } from './filtros'
import { COLOR_GASTO, COLOR_INGRESO, eurosResumen } from './formato'

interface Props {
  categorias: ResumenContable['categorias']
  totales: ResumenContable['totales']
  tipo: FiltrosUi['tipo']
  /** Id de la categoría filtrada, o `''`. */
  elegida: string
  onElegir: (id: string) => void
}

/** De dónde viene el dinero y a dónde va, por categoría. Pinchar una filtra todo por ella. */
export default function RepartoCategorias({ categorias, totales, tipo, elegida, onElegir }: Props) {
  // Todas las barras en la misma escala: la mayor categoría, sea ingreso o gasto, ocupa el ancho entero.
  const mayor = Math.max(1, ...categorias.map((c) => c.total))
  const grupos: { tipo: TipoApunte; titulo: string; total: number; color: string }[] = [
    { tipo: 'INGRESO', titulo: 'Ingresos', total: totales.ingresos, color: COLOR_INGRESO },
    { tipo: 'GASTO', titulo: 'Gastos', total: totales.gastos, color: COLOR_GASTO },
  ]

  return (
    <Paper component="section" aria-labelledby="reparto-titulo" sx={{ p: 2.5, height: '100%' }}>
      <Typography id="reparto-titulo" variant="h4" component="h2" sx={{ fontSize: 20 }}>De dónde viene y a dónde va</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Por categoría · pincha una para ver solo sus apuntes</Typography>
      {categorias.length === 0 && <Typography color="text.secondary">No hay apuntes en este periodo.</Typography>}
      {grupos
        .filter((g) => tipo === 'TODO' || tipo === g.tipo)
        .map((g) => {
          const lista = categorias.filter((c) => c.tipo === g.tipo)
          if (lista.length === 0) return null
          return (
            <Box key={g.tipo} sx={{ '& + &': { mt: 2 } }}>
              <Typography component="h3" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
                <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '2px', backgroundColor: g.color }} />
                {g.titulo} · {eurosResumen(g.total)}
              </Typography>
              {lista.map((c) => {
                const activa = elegida === String(c.id)
                const porcentaje = g.total > 0 ? Math.round((c.total / g.total) * 100) : 0
                return (
                  <ButtonBase
                    key={c.id}
                    onClick={() => onElegir(activa ? '' : String(c.id))}
                    aria-pressed={activa}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      columnGap: 1.5,
                      rowGap: 0.5,
                      width: '100%',
                      textAlign: 'left',
                      px: 1,
                      py: 0.75,
                      mx: -1,
                      borderRadius: 1,
                      boxSizing: 'content-box',
                      // Con una elegida, las demás se apagan: se ve qué está filtrando.
                      opacity: elegida && !activa ? 0.45 : 1,
                      backgroundColor: activa ? 'action.selected' : 'transparent',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <Typography component="span" sx={{ fontSize: 14 }}>{c.nombre}</Typography>
                    <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {eurosResumen(c.total)}
                      <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', ml: 0.75, fontSize: 12 }}>{porcentaje} %</Box>
                    </Typography>
                    <Box aria-hidden="true" sx={{ gridColumn: '1 / -1', height: 8, borderRadius: '4px', backgroundColor: '#f1eeea', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${Math.max((c.total / mayor) * 100, 1)}%`, backgroundColor: g.color, borderRadius: '0 4px 4px 0' }} />
                    </Box>
                  </ButtonBase>
                )
              })}
            </Box>
          )
        })}
    </Paper>
  )
}
