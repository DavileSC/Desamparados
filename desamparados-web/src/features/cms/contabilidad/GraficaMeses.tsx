import { useState } from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import type { ResumenContable } from '../../../lib/api/contabilidad'
import type { FiltrosUi } from './filtros'
import { COLOR_GASTO, COLOR_INGRESO, numero, etiquetaPunto, etiquetaPuntoLarga, euros, eurosResumen } from './formato'
import { useColoresContabilidad } from './tema'

const ANCHO = 640
const ALTO = 330
const IZQ = 56
const ARRIBA = 22
const BASE = 290
const DERECHA = 8
const oculto = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/**
 * Eje con marcas redondas (0, 2.000, 4.000…): el paso es 1, 2, 2,5 o 5 por la
 * potencia de diez que toque, para unas cuatro divisiones.
 */
function escalaEje(maximo: number) {
  if (maximo <= 0) return { techo: 100, marcas: [0, 25, 50, 75, 100] }
  const bruto = maximo / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = ([1, 2, 2.5, 5, 10].find((f) => f * potencia >= bruto) ?? 10) * potencia
  const techo = paso * Math.ceil(maximo / paso)
  return { techo, marcas: Array.from({ length: Math.round(techo / paso) + 1 }, (_, i) => i * paso) }
}

/** Barra apoyada en la base con los dos cantos de arriba redondeados (4 px). */
function barra(x: number, ancho: number, alto: number) {
  const h = Math.max(alto, 1)
  const y = BASE - h
  const r = Math.min(4, h, ancho / 2)
  return `M${x},${BASE} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${BASE} Z`
}

/** Ingresos y gastos de cada mes (o de cada año) del periodo, en barras emparejadas. */
export default function GraficaMeses({ serie, tipo }: { serie: ResumenContable['serie']; tipo: FiltrosUi['tipo'] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const { graficas, texto, texto2, emergente, emergenteBorde } = useColoresContabilidad()
  const puntos = serie.puntos
  const verIngresos = tipo !== 'GASTO'
  const verGastos = tipo !== 'INGRESO'
  const series = [verIngresos && 'ingresos', verGastos && 'gastos'].filter(Boolean) as ('ingresos' | 'gastos')[]
  const eje = escalaEje(Math.max(0, ...puntos.flatMap((p) => series.map((s) => p[s]))))
  const escala = (valor: number) => (valor / eje.techo) * (BASE - ARRIBA)
  const hueco = (ANCHO - IZQ - DERECHA) / Math.max(puntos.length, 1)
  const anchoBarra = Math.min(24, (hueco - 12 - (series.length - 1) * 2) / series.length)
  const grupo = anchoBarra * series.length + (series.length - 1) * 2
  const porMeses = serie.granularidad === 'mes'

  // Etiqueta directa solo en el pico de cada serie: un número en cada barra no se lee.
  const picos = series.map((s) => puntos.reduce((mejor, p, i) => (p[s] > puntos[mejor][s] ? i : mejor), 0))

  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h4" component="h2" sx={{ fontSize: 20 }}>{porMeses ? 'Mes a mes' : 'Año a año'}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {series.length === 2 ? 'Ingresos y gastos' : series[0] === 'ingresos' ? 'Ingresos' : 'Gastos'} de cada {porMeses ? 'mes' : 'año'} del periodo
      </Typography>
      {series.length === 2 && (
        <Stack direction="row" spacing={2} sx={{ mb: 1, fontSize: 13, color: 'text.secondary' }} aria-hidden="true">
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: COLOR_INGRESO }} />Ingresos</Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: COLOR_GASTO }} />Gastos</Box>
        </Stack>
      )}
      {puntos.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No hay apuntes en este periodo.</Typography>
      ) : (
        <Box component="svg" viewBox={`0 0 ${ANCHO} ${ALTO}`} sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} aria-hidden="true">
          {eje.marcas.map((marca) => {
            const y = BASE - escala(marca)
            return (
              <g key={marca}>
                <line x1={IZQ} x2={ANCHO - DERECHA} y1={y} y2={y} stroke={marca === 0 ? graficas.cero : graficas.rejilla} />
                <text x={IZQ - 8} y={y + 4} textAnchor="end" fontSize="12.5" fill={graficas.neutro}>{numero(marca)}</text>
              </g>
            )
          })}
          {puntos.map((p, i) => {
            const x = IZQ + i * hueco + (hueco - grupo) / 2
            return (
              <g
                key={p.clave}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                style={{ cursor: 'default' }}
              >
                {/* Zona de ratón más ancha que las barras. */}
                <rect x={IZQ + i * hueco} y={ARRIBA - 10} width={hueco} height={BASE - ARRIBA + 30} fill="transparent" />
                {activo === i && <rect x={IZQ + i * hueco + 2} y={ARRIBA - 6} width={hueco - 4} height={BASE - ARRIBA + 6} fill={graficas.banda} rx="4" />}
                {series.map((s, j) => (
                  <path key={s} d={barra(x + j * (anchoBarra + 2), anchoBarra, escala(p[s]))} fill={s === 'ingresos' ? COLOR_INGRESO : COLOR_GASTO} />
                ))}
                <text x={IZQ + i * hueco + hueco / 2} y={BASE + 22} textAnchor="middle" fontSize="13.5" fill={texto2}>{etiquetaPunto(p.clave)}</text>
              </g>
            )
          })}
          {series.map((s, j) => {
            const i = picos[j]
            const valor = puntos[i][s]
            if (valor <= 0 || activo !== null) return null
            const x = IZQ + i * hueco + (hueco - grupo) / 2 + j * (anchoBarra + 2) + anchoBarra / 2
            return <text key={s} x={x} y={BASE - escala(valor) - 7} textAnchor="middle" fontSize="13" fontWeight="600" fill={texto}>{eurosResumen(valor)}</text>
          })}
          {activo !== null && (() => {
            const p = puntos[activo]
            const anchoTip = 190
            const x = Math.min(Math.max(IZQ + activo * hueco + hueco / 2 - anchoTip / 2, IZQ), ANCHO - DERECHA - anchoTip)
            const lineas = [
              { texto: etiquetaPuntoLarga(p.clave), color: '#fff', peso: 600 },
              ...series.map((s) => ({ texto: `${s === 'ingresos' ? 'Ingresos' : 'Gastos'}: ${euros(p[s])}`, color: s === 'ingresos' ? '#cfe0f7' : '#f4d5d8', peso: 400 })),
            ]
            return (
              <g pointerEvents="none">
                <rect x={x} y={2} width={anchoTip} height={16 + lineas.length * 18} rx="6" fill={emergente} stroke={emergenteBorde} />
                {lineas.map((l, k) => <text key={k} x={x + 12} y={22 + k * 18} fontSize="13" fill={l.color} fontWeight={l.peso}>{l.texto}</text>)}
              </g>
            )
          })()}
        </Box>
      )}
      {/* La misma serie en tabla, para quien no ve la gráfica. */}
      <Box component="table" sx={oculto}>
        <caption>{porMeses ? 'Ingresos y gastos por mes' : 'Ingresos y gastos por año'}</caption>
        <thead><tr><th scope="col">{porMeses ? 'Mes' : 'Año'}</th>{series.map((s) => <th key={s} scope="col">{s === 'ingresos' ? 'Ingresos' : 'Gastos'}</th>)}</tr></thead>
        <tbody>{puntos.map((p) => <tr key={p.clave}><th scope="row">{etiquetaPuntoLarga(p.clave)}</th>{series.map((s) => <td key={s}>{euros(p[s])}</td>)}</tr>)}</tbody>
      </Box>
    </Paper>
  )
}
