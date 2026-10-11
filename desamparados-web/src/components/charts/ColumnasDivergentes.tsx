import { useId } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { brillo, type GraficasCms } from '../../theme/cms'
import { columna, pasoBonito, pasoEtiquetas } from './ejes'
import { useAnchoMedido } from './useAnchoMedido'
import { Degradado, Halo } from './brillo'

interface MesDivergente {
  mes: string
  arriba: number
  abajo: number
}

interface Props {
  meses: MesDivergente[]
  paleta: GraficasCms
  etiquetaArriba: string
  etiquetaAbajo: string
  etiquetaX?: (mes: string) => string
}

const ALTO = 140
const IZQ = 38
const DER = 10
const ARRIBA = 20
const ABAJO = 42

/**
 * Lo que entra arriba del cero y lo que sale debajo. Es la forma que deja ver
 * de un vistazo si un mes fue de crecimiento o de pérdida: dos series apiladas
 * en el mismo lado obligarían a restar a ojo.
 */
export default function ColumnasDivergentes({ meses, paleta, etiquetaArriba, etiquetaAbajo, etiquetaX }: Props) {
  // Con el tema del CMS, sus variables CSS: valen para los dos modos sin volver a pintar.
  const tema = useTheme()
  const colores = (tema as { vars?: { palette: typeof tema.palette } }).vars?.palette ?? tema.palette
  const id = useId().replace(/:/g, '')
  // El dibujo se hace a la medida del hueco: alto fijo, sin escalar (ver useAnchoMedido).
  const { referencia, ancho: ANCHO } = useAnchoMedido()

  if (meses.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const totalArriba = meses.reduce((s, m) => s + m.arriba, 0)
  const totalAbajo = meses.reduce((s, m) => s + m.abajo, 0)
  const enX = etiquetaX ?? ((mes: string) => mes)

  const paso = pasoBonito(Math.max(1, ...meses.map((m) => Math.max(m.arriba, m.abajo))) / 2)
  const techo = paso * Math.ceil(Math.max(1, ...meses.map((m) => m.arriba)) / paso)
  const suelo = -paso * Math.ceil(Math.max(1, ...meses.map((m) => m.abajo)) / paso)
  const altoUtil = ALTO - ARRIBA - ABAJO
  const Y = (v: number) => ARRIBA + ((techo - v) / (techo - suelo)) * altoUtil

  const ranura = (ANCHO - IZQ - DER) / meses.length
  const anchoColumna = Math.min(16, ranura * 0.55)
  const pasoX = pasoEtiquetas(meses.length, ANCHO - IZQ - DER)

  return (
    <Box ref={referencia} sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.25, mb: 1, fontSize: 13 }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}>
          <Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: paleta.entrada }} />
          <Typography component="span" variant="body2" color="text.secondary">{etiquetaArriba}</Typography>
          <Typography component="strong" variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{totalArriba}</Typography>
        </Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}>
          <Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: paleta.salida }} />
          <Typography component="span" variant="body2" color="text.secondary">{etiquetaAbajo}</Typography>
          <Typography component="strong" variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{totalAbajo}</Typography>
        </Box>
      </Box>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        height={ALTO}
        role="img"
        aria-label={`${etiquetaArriba}: ${totalArriba}. ${etiquetaAbajo}: ${totalAbajo}.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {/* La punta de cada columna es lo más luminoso: hacia arriba las altas, hacia abajo las bajas. */}
          <Degradado id={`arriba-${id}`} color={paleta.entrada} arriba={1} abajo={0.35} />
          <Degradado id={`abajo-${id}`} color={paleta.salida} arriba={0.35} abajo={1} />
          <Halo id={`halo-${id}`} radio={3} />
        </defs>
        {[techo, suelo].map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER} y2={Y(marca)} stroke={paleta.rejilla} strokeWidth="1" strokeDasharray="3 5" />
            <text x={IZQ - 8} y={Y(marca) + 4} textAnchor="end" fontSize="11" fill={colores.text.secondary}>
              {marca > 0 ? `+${marca}` : `−${-marca}`}
            </text>
          </g>
        ))}
        <line x1={IZQ} y1={Y(0)} x2={ANCHO - DER} y2={Y(0)} stroke={paleta.cero} strokeWidth="1" />
        <text x={IZQ - 8} y={Y(0) + 4} textAnchor="end" fontSize="11" fill={colores.text.secondary}>0</text>

        {meses.map((m, i) => {
          const x = IZQ + ranura * i + (ranura - anchoColumna) / 2
          return (
            <g key={m.mes}>
              {m.arriba > 0 && (
                <>
                  <path d={columna(x, Y(0) - 1, Y(m.arriba), anchoColumna)} fill={paleta.entrada} filter={`url(#halo-${id})`} style={{ opacity: brillo(paleta.brillo, 0.6) }} />
                  <path data-testid="columna-arriba" d={columna(x, Y(0) - 1, Y(m.arriba), anchoColumna)} fill={`url(#arriba-${id})`} />
                </>
              )}
              {m.abajo > 0 && (
                <>
                  <path d={columna(x, Y(0) + 1, Y(-m.abajo), anchoColumna)} fill={paleta.salida} filter={`url(#halo-${id})`} style={{ opacity: brillo(paleta.brillo, 0.6) }} />
                  <path data-testid="columna-abajo" d={columna(x, Y(0) + 1, Y(-m.abajo), anchoColumna)} fill={`url(#abajo-${id})`} />
                </>
              )}
              {i % pasoX === 0 && (
                <text x={x + anchoColumna / 2} y={ALTO - ABAJO + 18} textAnchor="middle" fontSize="11" fill={colores.text.secondary}>
                  {enX(m.mes)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </Box>
  )
}
