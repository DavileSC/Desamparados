import { useId, type ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { MECER, fondoResplandor, type TonoResplandor } from '../../../theme/resplandor'
import { Degradado, Halo } from '../../../components/charts/brillo'
import { curvaSuave } from '../../../components/charts/ejes'
import { eurosResumen, numero } from '../contabilidad/formato'
import { contar } from './plural'
import { aparecerSuave, CIFRA, crecerX, crecerY, entrada, sinMovimiento, trazar, useCuenta } from './animaciones'

/** La cifra grande, contando desde cero. */
function Valor({ valor, euros = false }: { valor: number; euros?: boolean }) {
  const actual = useCuenta(valor)
  return <>{euros ? eurosResumen(actual) : numero(Math.round(actual))}</>
}

/**
 * La serie como área: curva suave con brillo sobre un relleno que se
 * desvanece hacia abajo. La línea se dibuja de izquierda a derecha y el área
 * aparece detrás de ella.
 */
function Area({ valores, color, orden }: { valores: number[]; color: string; orden: number }) {
  const { graficas } = useTemaCms()
  const id = useId().replace(/:/g, '')
  if (valores.length < 2) return null
  const ancho = 200, alto = 52
  const min = Math.min(...valores), max = Math.max(...valores), rango = max - min || 1
  const puntos: [number, number][] = valores.map((v, i) => [i * (ancho / (valores.length - 1)), alto - 6 - ((v - min) / rango) * (alto - 16)])
  const d = curvaSuave(puntos)
  const [ux, uy] = puntos[puntos.length - 1]
  const retraso = `${300 + orden * 120}ms`
  return (
    <Box component="svg" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" aria-hidden="true" sx={{ display: 'block', width: '100%', height: 52, mt: 1.25, overflow: 'visible' }}>
      <defs>
        <Degradado id={`area-${id}`} color={color} arriba={0.45} />
        <Halo id={`halo-${id}`} radio={3} />
      </defs>
      <Box component="path" d={`${d} L${ancho},${alto} L0,${alto} Z`} fill={`url(#area-${id})`} sx={{ animation: `${aparecerSuave} 1s ease-out backwards`, animationDelay: retraso, ...sinMovimiento }} />
      <path d={d} fill="none" stroke={color} strokeWidth={4} filter={`url(#halo-${id})`} opacity={graficas.brillo} />
      <Box
        component="path"
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="1"
        sx={{ animation: `${trazar} 1.3s ease-out backwards`, animationDelay: retraso, ...sinMovimiento }}
      />
      <circle cx={ux} cy={uy} r={6} fill={color} opacity={graficas.brillo * 0.4} />
      <circle cx={ux} cy={uy} r={2.8} fill={color} />
    </Box>
  )
}

/** Columnas finas con degradado que crecen una tras otra; la última, la del año, brilla. */
function Columnas({ valores, color, orden }: { valores: number[]; color: string; orden: number }) {
  if (valores.length < 2) return null
  const max = Math.max(...valores), min = Math.min(...valores) * 0.8
  return (
    <Box aria-hidden="true" sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '8px', height: 52, mt: 1.25 }}>
      {valores.map((v, i) => {
        const ultima = i === valores.length - 1
        return (
          <Box
            key={i}
            sx={{
              flex: '1 1 0', maxWidth: 26, height: `${Math.max(12, ((v - min) / (max - min || 1)) * 100)}%`, borderRadius: '3px 3px 1px 1px',
              backgroundImage: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 25%, transparent))`,
              boxShadow: ultima ? `0 0 12px color-mix(in srgb, ${color} 40%, transparent)` : 'none',
              opacity: ultima ? 1 : 0.55,
              transformOrigin: 'bottom', animation: `${crecerY} .7s cubic-bezier(.2, .7, .2, 1) backwards`,
              animationDelay: `${350 + orden * 120 + i * 70}ms`, ...sinMovimiento,
            }}
          />
        )
      })}
    </Box>
  )
}

/** Pastilla con la variación: verde si sube, roja si baja. */
function Variacion({ valor, texto }: { valor: number; texto: string }) {
  const { graficas } = useTemaCms()
  const color = valor >= 0 ? graficas.estados.ok : graficas.estados.error
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.875, py: 0.125, borderRadius: 99,
        fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
        color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <span aria-hidden="true">{valor >= 0 ? '▲' : '▼'}</span>
      {valor >= 0 ? '+' : '−'}{texto}
    </Box>
  )
}

function Baldosa({ etiqueta, valor, pie, orden, tono, variacion, children }: {
  etiqueta: string; valor: ReactNode; pie: string; orden: number; tono: TonoResplandor
  variacion?: ReactNode; children?: ReactNode
}) {
  const { modo, superficies } = useTemaCms()
  return (
    <Paper sx={{ ...fondoResplandor(modo, tono, superficies.card), p: { xs: 1.75, sm: 2.25 }, borderRadius: 1.75, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', containerType: 'inline-size', ...entrada(orden + 1, MECER) }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{etiqueta}</Typography>
        {variacion}
      </Box>
      <Typography sx={{ ...CIFRA, fontSize: 'clamp(26px, 7cqi, 34px)', lineHeight: 1.1, mt: 0.5, overflowWrap: 'anywhere' }}>
        {valor}
      </Typography>
      <Typography variant="caption" color="text.secondary">{pie}</Typography>
      {/* Lo gráfico va al fondo de la baldosa: así las cuatro alinean su pie. */}
      <Box sx={{ mt: 'auto' }}>{children}</Box>
    </Paper>
  )
}

/**
 * Las cuatro cifras de hoy, en baldosas bajo el camino a la estación: son el
 * resumen de la casa, cada una con lo que la explica (su curva de doce meses o
 * de cinco años; lo por cobrar, repartido por estado).
 *
 * No las toca el selector de ejercicio: son cosas que hacer ahora, y mezclarlas
 * con un año cerrado despistaría.
 */
export default function Cifras({ panel }: { panel: PanelResponse }) {
  const { graficas, modo } = useTemaCms()
  const netos = panel.censo.altas12m - panel.censo.bajas12m

  // REMESADO cuenta como «por cobrar»: es dinero ya enviado al banco en un
  // lote SEPA, pero todavía no está en la cuenta. «Cómo va el año» ya lo
  // sumaba en el mismo sentido; sin él aquí, esta cifra y esa tarjeta se
  // contradecían en la misma pantalla.
  const PARTES = [
    { estado: 'PENDIENTE', texto: 'Pendiente', color: graficas.estados.aviso },
    { estado: 'REMESADO', texto: 'En el banco', color: graficas.entrada },
    { estado: 'DEVUELTO', texto: 'Devuelto', color: graficas.estados.error },
  ] as const
  const partes = PARTES.map((p) => {
    const fila = panel.dinero.porEstado.find((e) => e.estado === p.estado)
    return { ...p, total: fila?.total ?? 0, importe: fila?.importe ?? 0 }
  })
  const porCobrar = partes.reduce((s, e) => ({ total: s.total + e.total, importe: s.importe + e.importe }), { total: 0, importe: 0 })

  const saldo = panel.dinero.ejercicio.saldo
  const saldoMes = panel.dinero.serieMensual.reduce<number[]>(
    (serie, m) => [...serie, (serie.at(-1) ?? 0) + m.ingresos - m.gastos],
    [],
  )

  const anios = panel.procesion.porAnio
  const anterior = anios.find((a) => a.anio === panel.procesion.anio - 1)
  const diferencia = anterior ? panel.procesion.papeletas - anterior.total : null

  return (
    <Box
      component="section"
      aria-label="Cifras de hoy"
      sx={{
        display: 'grid', gap: 2,
        // De dos en dos incluso en el móvil: una debajo de otra ocupaban cuatro pantallas.
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        '@container (min-width: 900px)': { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
      }}
    >
      <Baldosa
        orden={0}
        tono="burdeos"
        variacion={<Variacion valor={netos} texto={`${numero(Math.abs(netos))} en el año`} />}
        etiqueta="Hermanos activos"
        valor={<Valor valor={panel.censo.activos} />}
        pie={`+${numero(panel.censo.altas12m)} / −${numero(panel.censo.bajas12m)} en doce meses`}
      >
        <Area valores={panel.censo.serieMensual.map((p) => p.activos)} color={graficas.acento} orden={0} />
      </Baldosa>
      <Baldosa
        orden={1}
        tono="oro"
        variacion={diferencia !== null ? <Variacion valor={diferencia} texto={numero(Math.abs(diferencia))} /> : undefined}
        etiqueta={`Papeletas ${panel.procesion.anio}`}
        valor={<Valor valor={panel.procesion.papeletas} />}
        pie={anterior ? `de sitio · ${numero(anterior.total)} en ${anterior.anio}` : 'de sitio'}
      >
        <Columnas valores={anios.map((a) => a.total)} color={modo === 'oscuro' ? '#c9ab3c' : '#9c8414'} orden={1} />
      </Baldosa>
      <Baldosa orden={2} tono="rosa" etiqueta="Por cobrar" valor={<Valor valor={porCobrar.importe} euros />} pie={contar(porCobrar.total, 'recibo', 'recibos')}>
        {porCobrar.importe > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Box
              role="img"
              aria-label={partes.filter((p) => p.importe > 0).map((p) => `${p.texto}: ${eurosResumen(p.importe)}`).join(', ')}
              sx={{ display: 'flex', gap: '2px', height: 8, borderRadius: 1, overflow: 'hidden', transformOrigin: 'left', boxShadow: `0 0 14px color-mix(in srgb, ${graficas.estados.aviso} ${Math.round(graficas.brillo * 45)}%, transparent)`, animation: `${crecerX} 1.2s cubic-bezier(.3, .7, .2, 1) .4s backwards`, ...sinMovimiento }}
            >
              {partes.filter((p) => p.importe > 0).map((p) => (
                <Box key={p.estado} sx={{ flexGrow: p.importe, backgroundColor: p.color, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0) 60%)' }} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', mt: 0.75, fontSize: 11.5, color: 'text.secondary' }}>
              {partes.filter((p) => p.importe > 0).map((p) => (
                <Box component="span" key={p.estado} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <Box component="span" sx={{ width: 7, height: 7, borderRadius: '2px', backgroundColor: p.color }} />
                  {p.texto}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Baldosa>
      <Baldosa
        orden={3}
        tono="azul"
        etiqueta={`Saldo ${panel.dinero.ejercicio.anio}`}
        valor={<Valor valor={saldo} euros />}
        pie={saldo >= 0 ? 'superávit' : 'déficit'}
      >
        <Area valores={saldoMes} color={saldo >= 0 ? graficas.entrada : graficas.salida} orden={3} />
      </Baldosa>
    </Box>
  )
}
