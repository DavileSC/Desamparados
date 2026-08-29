import { Box, Typography, useTheme } from '@mui/material'
import { designTokens } from '../../theme'

export interface PuntoLinea {
  x: string
  y: number
}

interface Props {
  puntos: PuntoLinea[]
  /** Qué mide la línea. Va en el aria-label y da nombre al gráfico. */
  etiqueta: string
  color?: string
  /** Segunda serie opcional, dibujada sobre la MISMA escala (ingresos y gastos). */
  comparar?: { etiqueta: string; puntos: PuntoLinea[]; color?: string }
}

const ANCHO = 600
const ALTO = 172
const MARGEN_X = 20
const SUELO = 150
const TECHO = 30

export default function LineaTemporal({ puntos, etiqueta, color, comparar }: Props) {
  const theme = useTheme()

  if (puntos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const series = [{ etiqueta, puntos, color: color ?? designTokens.dataviz.series[0], principal: true }]
  if (comparar && comparar.puntos.length > 0) {
    series.push({
      etiqueta: comparar.etiqueta,
      puntos: comparar.puntos,
      color: comparar.color ?? designTokens.dataviz.series[1],
      principal: false,
    })
  }

  // Escala común a todas las series. Con una escala por serie, dos líneas que
  // se cruzan no significarían nada.
  const todos = series.flatMap((s) => s.puntos.map((p) => p.y))
  const max = Math.max(...todos)
  const min = Math.min(...todos)
  // Si todos los valores son iguales el rango es 0 y la escala daría NaN.
  const rango = max - min || 1

  const trazar = (ps: PuntoLinea[]) => {
    const paso = ps.length > 1 ? (ANCHO - MARGEN_X * 2) / (ps.length - 1) : 0
    return ps.map((p, i) => ({
      cx: MARGEN_X + paso * i,
      cy: SUELO - ((p.y - min) / rango) * (SUELO - TECHO),
    }))
  }

  const trazos = series.map((serie) => {
    const coordenadas = trazar(serie.puntos)
    return {
      serie,
      coordenadas,
      ultimo: coordenadas[coordenadas.length - 1],
      ultimoValor: serie.puntos[serie.puntos.length - 1],
    }
  })

  // Las etiquetas del último valor se pisaban cuando las dos series cerraban el
  // mes casi igual (pasó en tesorería: 939 € de ingresos y 939,50 € de gastos).
  // Si están demasiado cerca, una se va arriba del punto y la otra debajo.
  const SEPARACION_MINIMA = 14
  const seEstorban =
    trazos.length === 2 && Math.abs(trazos[0].ultimo.cy - trazos[1].ultimo.cy) < SEPARACION_MINIMA
  const laDeArriba = trazos.length === 2 && trazos[1].ultimo.cy < trazos[0].ultimo.cy ? 1 : 0
  const desvioEtiqueta = (indice: number) => {
    if (!seEstorban) return -10
    return indice === laDeArriba ? -12 : 20
  }

  const descripcion = series
    .map((s) => `${s.etiqueta}: de ${s.puntos[0].y} a ${s.puntos[s.puntos.length - 1].y}`)
    .join('. ')

  return (
    <Box sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={`${descripcion}.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {[SUELO, 106, 62].map((y) => (
          <line key={y} x1="0" y1={y} x2={ANCHO} y2={y} stroke={theme.palette.divider} strokeWidth="1" />
        ))}

        {trazos.map(({ serie, coordenadas, ultimo, ultimoValor }, indice) => {
          const d = coordenadas.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx},${c.cy}`).join(' ')
          return (
            <g key={serie.etiqueta}>
              {/* El área solo bajo la serie principal: dos rellenos superpuestos
                  ensucian y ninguna de las dos se lee bien. */}
              {serie.principal && (
                <path
                  d={`${d} L${ultimo.cx},${SUELO} L${coordenadas[0].cx},${SUELO} Z`}
                  fill={serie.color}
                  opacity="0.13"
                />
              )}
              <path
                data-testid={serie.principal ? 'linea' : 'linea-comparada'}
                d={d}
                fill="none"
                stroke={serie.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={ultimo.cx} cy={ultimo.cy} r="5" fill={serie.color} stroke={theme.palette.background.paper} strokeWidth="2">
                <title>{`${serie.etiqueta} · ${ultimoValor.x}: ${ultimoValor.y}`}</title>
              </circle>
              {/* Etiqueta directa del ultimo valor: el color no puede ser el
                  unico portador del dato. El verde y el ambar de la paleta no
                  llegan a 3:1 sobre el lienzo claro del CMS. */}
              <text
                x={ultimo.cx - 8}
                y={ultimo.cy + desvioEtiqueta(indice)}
                textAnchor="end"
                fontSize="11"
                fontWeight="600"
                fill={theme.palette.text.secondary}
              >
                {ultimoValor.y}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Leyenda obligatoria a partir de dos series: el color por sí solo no
          identifica nada para quien no lo distingue. */}
      {series.length > 1 && (
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          {series.map((serie) => (
            <Box key={serie.etiqueta} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '2px', backgroundColor: serie.color }} />
              <Typography variant="caption" color="text.secondary">{serie.etiqueta}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
