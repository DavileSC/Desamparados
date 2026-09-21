import type { ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import SouthWestIcon from '@mui/icons-material/SouthWest'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import BalanceIcon from '@mui/icons-material/Balance'
import type { ResumenContable } from '../../../lib/api/contabilidad'
import type { FiltrosUi } from './filtros'
import { COLOR_GASTO, COLOR_INGRESO, numero, eurosResumen, tramo } from './formato'

const COLOR_RESULTADO = '#6b6266'

function Cifra({ titulo, icono, color, valor, detalle, apagada = false }: { titulo: string; icono: ReactNode; color: string; valor: string; detalle: ReactNode; apagada?: boolean }) {
  return (
    <Paper sx={{ position: 'relative', flex: 1, p: 2.25, pl: 3, overflow: 'hidden', opacity: apagada ? 0.4 : 1, '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: color } }}>
      <Typography component="h3" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', '& svg': { fontSize: 17, color } }}>
        {icono}{titulo}
      </Typography>
      <Typography sx={{ fontFamily: (t) => t.typography.h1.fontFamily, fontSize: 30, lineHeight: 1.2, mt: 0.75 }}>{valor}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{detalle}</Typography>
    </Paper>
  )
}

/** Ingresos, gastos y resultado de lo filtrado, con el mismo tramo del año anterior al lado. */
export default function CifrasPeriodo({ resumen, tipo }: { resumen: ResumenContable; tipo: FiltrosUi['tipo'] }) {
  const { totales, anterior } = resumen
  const comparacion = (valor: number) => anterior && <> · {tramo(anterior.desde, anterior.hasta)}: {eurosResumen(valor)}</>
  const plural = (n: number) => `${numero(n)} ${n === 1 ? 'apunte' : 'apuntes'}`
  // El resultado se lee con palabras: nada de «+» o «−» delante de la cifra.
  const sentido = totales.resultado > 0 ? 'superávit' : totales.resultado < 0 ? 'déficit' : 'equilibrio'

  return (
    <Box component="section" aria-label="Cifras del periodo" sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
      <Cifra
        titulo="Ingresos"
        icono={<SouthWestIcon />}
        color={COLOR_INGRESO}
        valor={tipo === 'GASTO' ? '—' : eurosResumen(totales.ingresos)}
        detalle={tipo === 'GASTO' ? 'No se muestran' : <>{plural(totales.apuntesIngreso)}{comparacion(anterior?.ingresos ?? 0)}</>}
        apagada={tipo === 'GASTO'}
      />
      <Cifra
        titulo="Gastos"
        icono={<NorthEastIcon />}
        color={COLOR_GASTO}
        valor={tipo === 'INGRESO' ? '—' : eurosResumen(totales.gastos)}
        detalle={tipo === 'INGRESO' ? 'No se muestran' : <>{plural(totales.apuntesGasto)}{comparacion(anterior?.gastos ?? 0)}</>}
        apagada={tipo === 'INGRESO'}
      />
      <Cifra
        titulo="Resultado"
        icono={<BalanceIcon />}
        color={COLOR_RESULTADO}
        valor={tipo === 'TODO' ? eurosResumen(Math.abs(totales.resultado)) : '—'}
        detalle={tipo === 'TODO' ? sentido : 'Solo con ingresos y gastos'}
        apagada={tipo !== 'TODO'}
      />
    </Box>
  )
}
