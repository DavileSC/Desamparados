import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { ColorDato, CuerpoGrafica, FormatoDato, GraficaDato } from '../../../lib/api/datos'
import { segunModo } from '../../../theme/cms'
import { colorDelTipo } from '../agenda/tiposEvento'
import { numero } from '../contabilidad/formato'
import { crecerX, crecerY, sinMovimiento } from '../inicio/animaciones'
import { AZUL_GRAFICA, FILETE_SUAVE, ORO, ORO_GRAFICA, ROJO_GRAFICA, SERIF, VERDE } from '../inicio/estiloRetablo'

const GRIS_GRAFICA = segunModo('#b9aeb2', '#6f666b')

/** Los colores con nombre que manda el servidor, en los del CMS (claro u oscuro). */
export function colorDe(c: ColorDato): string {
  if (c.startsWith('tipo:')) return colorDelTipo(c.slice(5) as Parameters<typeof colorDelTipo>[0])
  return { oro: ORO_GRAFICA, rojo: ROJO_GRAFICA, verde: VERDE, azul: AZUL_GRAFICA, gris: GRIS_GRAFICA }[c as 'oro'] ?? GRIS_GRAFICA
}

export function Muestra({ color, children }: { color: ColorDato; children: ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: '2px', flexShrink: 0, backgroundColor: colorDe(color) }} />
      {children}
    </Box>
  )
}

const rotulo = { fontSize: 11.5, color: 'text.secondary', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', textAlign: 'center', whiteSpace: 'nowrap' } as const

/** Sobre la columna, corto: «3,7 k», «952». Que son euros ya lo dicen el título y la leyenda. */
const corto = (v: number, formato: FormatoDato) =>
  formato === 'euros' && v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} k` : numero(Math.round(v))

const crecer = (i: number) => ({ transformOrigin: 'bottom', animation: `${crecerY} .6s cubic-bezier(.2, .7, .2, 1) backwards`, animationDelay: `${120 + i * 35}ms`, ...sinMovimiento })

/** Columnas por mes o por año; con varias series, una al lado de otra. */
function Columnas({ c }: { c: Extract<CuerpoGrafica, { tipo: 'columnas' }> }) {
  const max = Math.max(1, ...c.series.flatMap((s) => s.valores))
  const descripcion = c.etiquetas.map((et, i) => `${et}: ${c.series.map((s) => `${corto(s.valores[i] ?? 0, c.formato)} ${s.nombre}`).join(', ')}`).join('; ')
  return (
    <Box
      role="img"
      aria-label={descripcion}
      sx={{
        flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', containerType: 'inline-size',
        // Sin sitio para cada cifra (unos 34px por barra si van de dos en dos,
        // 24 si va sola), se pisaban unas con otras: en el móvil, doce meses de
        // ingresos y gastos. Se quitan y la gráfica se lee por las alturas; las
        // cifras siguen en la descripción.
        [`@container (max-width: ${c.etiquetas.length * c.series.length * (c.series.length > 1 ? 34 : 24)}px)`]: { '& .cifra-columna': { visibility: 'hidden' } },
      }}
    >
      <Box sx={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${c.etiquetas.length}, minmax(0, 1fr))`, borderBottom: '1px solid', borderColor: 'divider' }}>
        {c.etiquetas.map((et, i) => {
          const apagada = c.destacar !== undefined && c.destacar !== i
          return (
            <Box key={et + i} sx={{ minWidth: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', px: '6%' }}>
              {c.series.map((s) => {
                const v = s.valores[i] ?? 0
                return (
                  <Box key={s.nombre} sx={{ flex: '1 1 0', maxWidth: 40, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }}>
                    <Box aria-hidden="true" className="cifra-columna" sx={{ ...rotulo, fontSize: c.series.length > 1 ? 10.5 : 11.5, ...(!apagada && c.destacar !== undefined && { color: 'text.primary', fontWeight: 600 }) }}>{v ? corto(v, c.formato) : ''}</Box>
                    <Box
                      sx={{
                        width: '100%', height: `${(v / max) * 86}%`, minHeight: v > 0 ? 2 : 0, borderRadius: '3px 3px 0 0',
                        backgroundImage: `linear-gradient(180deg, ${colorDe(s.color)}, color-mix(in srgb, ${colorDe(s.color)} 45%, transparent))`,
                        opacity: apagada ? 0.5 : 1, ...crecer(i),
                      }}
                    />
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
      <Box aria-hidden="true" sx={{ display: 'grid', gridTemplateColumns: `repeat(${c.etiquetas.length}, minmax(0, 1fr))`, pt: 0.75 }}>
        {c.etiquetas.map((et, i) => <Box key={et + i} sx={{ ...rotulo, ...(c.destacar === i && { color: 'text.primary', fontWeight: 700 }) }}>{et}</Box>)}
      </Box>
    </Box>
  )
}

/** Columnas apiladas por tipo, con la raya de hoy. */
function Apiladas({ c }: { c: Extract<CuerpoGrafica, { tipo: 'apiladas' }> }) {
  const totales = c.etiquetas.map((_, i) => c.capas.reduce((s, capa) => s + (capa.valores[i] ?? 0), 0))
  const max = Math.max(1, ...totales)
  const descripcion = c.etiquetas.map((et, i) => `${et}: ${totales[i]}`).join('; ')
  return (
    <Box role="img" aria-label={`Actos por mes: ${descripcion}`} sx={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${c.etiquetas.length}, minmax(0, 1fr))`, borderBottom: '1px solid', borderColor: 'divider' }}>
        {c.etiquetas.map((et, i) => (
          <Box
            key={et + i}
            sx={{
              position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
              ...(c.hoy === i && { borderLeft: `1px dashed ${ORO}` }),
            }}
          >
            {c.hoy === i && <Box aria-hidden="true" sx={{ position: 'absolute', top: 0, left: 4, fontSize: 11, color: ORO }}>hoy</Box>}
            <Box aria-hidden="true" sx={rotulo}>{totales[i] || ''}</Box>
            <Box sx={{ width: '58%', maxWidth: 36, height: `${(totales[i] / max) * 86}%`, display: 'flex', flexDirection: 'column-reverse', gap: '2px', ...crecer(i) }}>
              {c.capas.map((capa) => (capa.valores[i] ? <Box key={capa.nombre} sx={{ flexGrow: capa.valores[i], flexBasis: 0, borderRadius: '2px', backgroundColor: colorDe(capa.color) }} /> : null))}
            </Box>
          </Box>
        ))}
      </Box>
      <Box aria-hidden="true" sx={{ display: 'grid', gridTemplateColumns: `repeat(${c.etiquetas.length}, minmax(0, 1fr))`, pt: 0.75 }}>
        {c.etiquetas.map((et, i) => <Box key={et + i} sx={{ ...rotulo, ...(c.hoy === i && { color: 'text.primary', fontWeight: 700 }) }}>{et}</Box>)}
      </Box>
    </Box>
  )
}

/** Una fila por concepto: el nombre, su barra (partida en tramos si hay varios valores) y la cifra. */
function Barras({ c }: { c: Extract<CuerpoGrafica, { tipo: 'barras' }> }) {
  const max = Math.max(1, ...c.filas.map((f) => f.valores.reduce((s, v) => s + v, 0)))
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, flex: '1 1 0', minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', justifyContent: c.filas.length <= 8 ? 'center' : 'flex-start' }}>
      {c.filas.map((f, i) => (
        <Box
          component="li"
          key={f.etiqueta}
          sx={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 170px) minmax(0, 1fr) auto', alignItems: 'center', gap: 2, py: 'clamp(3px, 0.8vh, 10px)', borderTop: `1px solid ${FILETE_SUAVE}`, '&:last-of-type': { borderBottom: `1px solid ${FILETE_SUAVE}` } }}
        >
          <Box component="span" sx={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.etiqueta}</Box>
          <Box aria-hidden="true" sx={{ display: 'flex', gap: '1px', height: 12, transformOrigin: 'left', animation: `${crecerX} .7s cubic-bezier(.2, .7, .2, 1) backwards`, animationDelay: `${100 + i * 40}ms`, ...sinMovimiento }}>
            {f.valores.map((v, j) => (v ? <Box key={j} sx={{ width: `${(v / max) * 100}%`, borderRadius: '2px', backgroundColor: colorDe(c.colores[j] ?? c.colores[0]) }} /> : null))}
          </Box>
          <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{f.nota}</Box>
        </Box>
      ))}
    </Box>
  )
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Los actos de un tipo, uno por línea: fecha, hora, título y lugar. Los pasados, apagados. */
function Lista({ c }: { c: Extract<CuerpoGrafica, { tipo: 'lista' }> }) {
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
      {c.filas.map((f, i) => (
        <Box
          component="li"
          key={`${f.dia}-${i}`}
          sx={{ display: 'grid', gridTemplateColumns: '92px 44px minmax(0, 1fr)', alignItems: 'baseline', gap: 1.5, py: 0.75, borderTop: `1px solid ${FILETE_SUAVE}`, color: f.pasado ? 'text.secondary' : 'text.primary' }}
        >
          <Box component="span" sx={{ ...SERIF, fontSize: 17, whiteSpace: 'nowrap' }}>{`${Number(f.dia.slice(8, 10))} ${MESES[Number(f.dia.slice(5, 7)) - 1]} ${f.dia.slice(2, 4)}`}</Box>
          <Box component="span" sx={{ fontSize: 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{f.hora ?? ''}</Box>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box component="span" aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: colorDe(f.color) }} />
            <Box component="span" sx={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.titulo}{f.lugar && <Box component="span" sx={{ color: 'text.secondary' }}> · {f.lugar}</Box>}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

/** El cuerpo de una gráfica de «Datos e informes», o lo que dice cuando no hay nada. */
export default function GraficaDatos({ grafica }: { grafica: GraficaDato }) {
  if (grafica.vacio) return <Typography sx={{ m: 'auto', fontSize: 14, color: 'text.secondary' }}>{grafica.vacio}</Typography>
  const c = grafica.cuerpo
  if (c.tipo === 'columnas') return <Columnas c={c} />
  if (c.tipo === 'apiladas') return <Apiladas c={c} />
  if (c.tipo === 'barras') return <Barras c={c} />
  return <Lista c={c} />
}
