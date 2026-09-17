import { Box, Typography, useTheme } from '@mui/material'
import type { GraficasCms } from '../../theme/cms'
import { pasoBonito } from './ejes'
import { useAnchoMedido } from './useAnchoMedido'

export interface PuntoLinea {
  x: string
  y: number
}

interface Props {
  puntos: PuntoLinea[]
  /** Qué mide la línea. Va en el aria-label y da nombre al gráfico. */
  etiqueta: string
  paleta: GraficasCms
  /** Por defecto, el color de énfasis: esta gráfica no compara nada. */
  color?: string
  formatoValor?: (valor: number) => string
  /** '2026-09' → 'sep'. Por defecto, la clave tal cual. */
  etiquetaX?: (x: string) => string
}

const ALTO = 150
const IZQ = 50
const DER = 54
const ARRIBA = 18
const ABAJO = 42

/** Eje que abarca los datos con marcas en números redondos, unas tres. */
function escala(min: number, max: number) {
  if (max === min) return { suelo: min - 1, techo: min + 1, marcas: [min] }
  const paso = pasoBonito((max - min) / 2)
  const suelo = Math.floor(min / paso) * paso
  const techo = Math.ceil(max / paso) * paso
  const marcas: number[] = []
  for (let v = suelo; v <= techo + paso / 1000; v += paso) marcas.push(Math.round(v * 100) / 100)
  return { suelo, techo, marcas }
}

/**
 * Una serie en el tiempo, con área. Los valores del primero y el último punto
 * van escritos: el ratón añade detalle, pero nunca es la única forma de leer un
 * dato.
 */
export default function LineaTemporal({ puntos, etiqueta, paleta, color, formatoValor, etiquetaX }: Props) {
  const theme = useTheme()
  // El dibujo se hace a la medida del hueco: alto fijo, sin escalar (ver useAnchoMedido).
  const { referencia, ancho: ANCHO } = useAnchoMedido()

  if (puntos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const trazo = color ?? paleta.enfasis
  const texto = (valor: number) => (formatoValor ? formatoValor(valor) : String(valor))
  const enX = etiquetaX ?? ((x: string) => x)

  const valores = puntos.map((p) => p.y)
  const { suelo, techo, marcas } = escala(Math.min(...valores), Math.max(...valores))
  const rango = techo - suelo || 1
  const anchoUtil = ANCHO - IZQ - DER
  const altoUtil = ALTO - ARRIBA - ABAJO

  const X = (i: number) => IZQ + (puntos.length > 1 ? (i * anchoUtil) / (puntos.length - 1) : anchoUtil / 2)
  const Y = (v: number) => ARRIBA + altoUtil - ((v - suelo) / rango) * altoUtil

  const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
  const primero = puntos[0]
  const ultimo = puntos[puntos.length - 1]

  return (
    <Box ref={referencia} sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        height={ALTO}
        role="img"
        aria-label={`${etiqueta}: de ${texto(primero.y)} a ${texto(ultimo.y)}.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {marcas.map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER + 8} y2={Y(marca)} stroke={paleta.rejilla} strokeWidth="1" />
            <text
              x={IZQ - 10}
              y={Y(marca) + 4}
              textAnchor="end"
              fontSize="11"
              fill={theme.palette.text.secondary}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {marca}
            </text>
          </g>
        ))}

        <path d={`${d} L${X(puntos.length - 1).toFixed(1)},${Y(suelo).toFixed(1)} L${X(0).toFixed(1)},${Y(suelo).toFixed(1)} Z`} fill={trazo} opacity="0.1" />
        <path data-testid="linea" d={d} fill="none" stroke={trazo} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Primer punto: la etiqueta va DEBAJO, donde no hay trazo. */}
        <circle cx={X(0)} cy={Y(primero.y)} r="4" fill={trazo} stroke={theme.palette.background.paper} strokeWidth="2" />
        <text x={X(0) + 8} y={Y(primero.y) + 20} fontSize="12" fontWeight="600" fill={theme.palette.text.secondary}>
          {texto(primero.y)}
        </text>

        <circle cx={X(puntos.length - 1)} cy={Y(ultimo.y)} r="5" fill={trazo} stroke={theme.palette.background.paper} strokeWidth="2" />
        <text x={X(puntos.length - 1) + 10} y={Y(ultimo.y) + 4} fontSize="13" fontWeight="700" fill={theme.palette.text.primary}>
          {texto(ultimo.y)}
        </text>

        {puntos.map((p, i) => (
          <text key={p.x} x={X(i)} y={ALTO - ABAJO + 18} textAnchor="middle" fontSize="11" fill={theme.palette.text.secondary}>
            {enX(p.x)}
          </text>
        ))}
      </svg>
    </Box>
  )
}
