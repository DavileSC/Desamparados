import { Box, Typography, useTheme } from '@mui/material'
import type { GraficasCms } from '../../theme/cms'
import { columna, escalaDesdeCero } from './ejes'

interface Props {
  datos: { anio: number; total: number }[]
  paleta: GraficasCms
  /** El ejercicio elegido: va en tinta, el resto en gris. */
  destacado: number
  /** Con punto de miles cuando lo pasa quien llama. Por defecto, el número tal cual. */
  formatoValor?: (valor: number) => string
}

const ANCHO = 488
const ALTO = 232
const IZQ = 40
const DER = 10
const ARRIBA = 26
const ABAJO = 30

/** Una columna por año, con su valor escrito encima: cinco cifras se leen mejor así que en una línea. */
export default function ColumnasPorAnio({ datos, paleta, destacado, formatoValor }: Props) {
  const theme = useTheme()
  const texto = formatoValor ?? ((v: number) => String(v))

  if (datos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const eje = escalaDesdeCero(Math.max(...datos.map((d) => d.total)))
  const altoUtil = ALTO - ARRIBA - ABAJO
  const Y = (v: number) => ARRIBA + altoUtil - (v / eje.techo) * altoUtil
  const ranura = (ANCHO - IZQ - DER) / datos.length
  const ancho = Math.min(24, ranura * 0.45)

  return (
    <Box sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={datos.map((d) => `${d.anio}: ${texto(d.total)}`).join('. ')}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Las marcas intermedias van por debajo de las cifras de cada columna, así nunca las cruzan. */}
        {eje.marcas.filter((m) => m < eje.techo).map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER} y2={Y(marca)} stroke={marca === 0 ? paleta.cero : paleta.rejilla} strokeWidth="1" />
            <text x={IZQ - 10} y={Y(marca) + 4} textAnchor="end" fontSize="11" fill={theme.palette.text.secondary}>{marca}</text>
          </g>
        ))}

        {datos.map((d, i) => {
          const x = IZQ + ranura * i + (ranura - ancho) / 2
          const esElegido = d.anio === destacado
          return (
            <g key={d.anio}>
              <path data-testid="columna" d={columna(x, Y(0), Y(d.total), ancho)} fill={esElegido ? paleta.enfasis : paleta.contexto} />
              <text x={x + ancho / 2} y={Y(d.total) - 8} textAnchor="middle" fontSize="12" fontWeight={esElegido ? 700 : 600} fill={esElegido ? theme.palette.text.primary : theme.palette.text.secondary}>
                {texto(d.total)}
              </text>
              <text x={x + ancho / 2} y={ALTO - 8} textAnchor="middle" fontSize="12" fontWeight={esElegido ? 700 : 400} fill={esElegido ? theme.palette.text.primary : theme.palette.text.secondary}>
                {d.anio}
              </text>
            </g>
          )
        })}
      </svg>
    </Box>
  )
}
