import { useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import type { GraficasCms } from '../../theme/cms'
import { columna, escalaDesdeCero } from './ejes'

export interface PuntoPar {
  clave: string
  a: number
  b: number
}

interface Props {
  puntos: PuntoPar[]
  paleta: GraficasCms
  etiquetaA: string
  etiquetaB: string
  formatoValor: (valor: number) => string
  etiquetaX: (clave: string) => string
  /** Para el detalle del ratón: «marzo de 2026». */
  etiquetaXLarga: (clave: string) => string
}

const ANCHO = 1042
const ALTO = 300
const IZQ = 66
const DER = 12
const ARRIBA = 24
const ABAJO = 30

/**
 * Dos series emparejadas por periodo, en la misma escala. Los picos de cada
 * serie van escritos aunque nadie pase el ratón; el emergente añade el detalle
 * del mes señalado, pero no es la única forma de leer la gráfica.
 */
export default function ColumnasPorPares({
  puntos, paleta, etiquetaA, etiquetaB, formatoValor, etiquetaX, etiquetaXLarga,
}: Props) {
  const theme = useTheme()
  const [activo, setActivo] = useState<number | null>(null)

  if (puntos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const eje = escalaDesdeCero(Math.max(0, ...puntos.flatMap((p) => [p.a, p.b])))
  const altoUtil = ALTO - ARRIBA - ABAJO
  const Y = (v: number) => ARRIBA + altoUtil - (v / eje.techo) * altoUtil
  const ranura = (ANCHO - IZQ - DER) / puntos.length
  const ancho = Math.min(22, (ranura - 12) / 2)

  const picoDe = (lado: 'a' | 'b') =>
    puntos.reduce((mejor, p, i) => (p[lado] > puntos[mejor][lado] ? i : mejor), 0)

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={`${etiquetaA} y ${etiquetaB} por periodo.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {eje.marcas.map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER} y2={Y(marca)} stroke={marca === 0 ? paleta.cero : paleta.rejilla} strokeWidth="1" />
            <text x={IZQ - 12} y={Y(marca) + 4} textAnchor="end" fontSize="11" fill={theme.palette.text.secondary} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatoValor(marca)}
            </text>
          </g>
        ))}

        {puntos.map((p, i) => {
          const centro = IZQ + ranura * i + ranura / 2
          return (
            <g key={p.clave} onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}>
              {activo === i && (
                <rect x={IZQ + ranura * i + 4} y={ARRIBA - 10} width={ranura - 8} height={altoUtil + 10} rx="8" fill={paleta.banda} />
              )}
              {/* Zona de ratón más ancha que las columnas. */}
              <rect data-testid="zona" x={IZQ + ranura * i} y={ARRIBA - 10} width={ranura} height={altoUtil + 30} fill="transparent" />
              <path data-testid="columna" d={columna(centro - ancho - 1, Y(0), Y(p.a), ancho)} fill={paleta.entrada} />
              <path data-testid="columna" d={columna(centro + 1, Y(0), Y(p.b), ancho)} fill={paleta.salida} />
              <text x={centro} y={ALTO - 8} textAnchor="middle" fontSize="12" fill={activo === i ? theme.palette.text.primary : theme.palette.text.secondary} fontWeight={activo === i ? 700 : 400}>
                {etiquetaX(p.clave)}
              </text>
            </g>
          )
        })}

        {/* Etiqueta directa en el pico de cada serie, y solo mientras nadie
            señala un mes: con el emergente abierto, la misma cifra saldría dos
            veces. */}
        {(['a', 'b'] as const).map((lado, j) => {
          const i = picoDe(lado)
          const valor = puntos[i][lado]
          if (valor <= 0 || activo !== null) return null
          const centro = IZQ + ranura * i + ranura / 2
          const x = j === 0 ? centro - ancho / 2 - 1 : centro + ancho / 2 + 1
          return (
            <text key={lado} x={x} y={Y(valor) - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill={theme.palette.text.primary}>
              {formatoValor(valor)}
            </text>
          )
        })}
      </svg>

      {activo !== null && (
        <Box
          sx={{
            position: 'absolute', top: 8, left: `${((IZQ + ranura * activo + ranura) / ANCHO) * 100}%`,
            transform: 'translateX(8px)', pointerEvents: 'none', minWidth: 188,
            backgroundColor: 'background.paper', border: 1, borderColor: 'divider',
            borderRadius: 1.25, px: 1.5, py: 1.25, boxShadow: 3, fontSize: 13, zIndex: 1,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
            {etiquetaXLarga(puntos[activo].clave)}
          </Typography>
          {([[etiquetaA, puntos[activo].a, paleta.entrada], [etiquetaB, puntos[activo].b, paleta.salida]] as const).map(
            ([texto, valor, color]) => (
              <Box key={texto} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Box component="span" sx={{ width: 12, height: 2, backgroundColor: color }} />
                <Typography component="strong" variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatoValor(valor)}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">{texto}</Typography>
              </Box>
            ),
          )}
        </Box>
      )}
    </Box>
  )
}
