import type { ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { eurosResumen, numero } from '../contabilidad/formato'
import { contar } from './plural'
import { CIFRA, crecerX, entrada, sinMovimiento, trazar, useCuenta } from './animaciones'

/** La cifra grande, contando desde cero. */
function Valor({ valor, euros = false }: { valor: number; euros?: boolean }) {
  const actual = useCuenta(valor)
  return <>{euros ? eurosResumen(actual) : numero(Math.round(actual))}</>
}

/** Curva de la serie, que se dibuja de izquierda a derecha con un punto al final. */
function Curva({ valores, color, orden }: { valores: number[]; color: string; orden: number }) {
  if (valores.length < 2) return null
  const ancho = 200, alto = 40
  const min = Math.min(...valores), max = Math.max(...valores), rango = max - min || 1
  const puntos = valores.map((v, i) => [i * (ancho / (valores.length - 1)), alto - 4 - ((v - min) / rango) * (alto - 10)])
  const d = puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [ux, uy] = puntos[puntos.length - 1]
  return (
    <Box component="svg" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" aria-hidden="true" sx={{ display: 'block', width: '100%', height: 40, mt: 1.25, overflow: 'visible' }}>
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
        sx={{ animation: `${trazar} 1.3s ease-out backwards`, animationDelay: `${300 + orden * 120}ms`, ...sinMovimiento }}
      />
      <circle cx={ux} cy={uy} r={2.6} fill={color} />
    </Box>
  )
}

function Baldosa({ etiqueta, valor, pie, orden, children }: { etiqueta: string; valor: ReactNode; pie: string; orden: number; children?: ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 1.75, sm: 2.25 }, borderRadius: 1.75, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', containerType: 'inline-size', ...entrada(orden + 1) }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{etiqueta}</Typography>
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
  const { graficas, superficies } = useTemaCms()

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
        etiqueta="Hermanos activos"
        valor={<Valor valor={panel.censo.activos} />}
        pie={`+${numero(panel.censo.altas12m)} / −${numero(panel.censo.bajas12m)} en doce meses`}
      >
        <Curva valores={panel.censo.serieMensual.map((p) => p.activos)} color={superficies.enlace} orden={0} />
      </Baldosa>
      <Baldosa
        orden={1}
        etiqueta={`Papeletas ${panel.procesion.anio}`}
        valor={<Valor valor={panel.procesion.papeletas} />}
        pie={diferencia === null ? 'de sitio' : `${diferencia >= 0 ? '+' : '−'}${numero(Math.abs(diferencia))} sobre ${anterior!.anio}`}
      >
        <Curva valores={anios.map((a) => a.total)} color={graficas.enfasis} orden={1} />
      </Baldosa>
      <Baldosa orden={2} etiqueta="Por cobrar" valor={<Valor valor={porCobrar.importe} euros />} pie={contar(porCobrar.total, 'recibo', 'recibos')}>
        {porCobrar.importe > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Box
              role="img"
              aria-label={partes.filter((p) => p.importe > 0).map((p) => `${p.texto}: ${eurosResumen(p.importe)}`).join(', ')}
              sx={{ display: 'flex', height: 8, borderRadius: 1, overflow: 'hidden', transformOrigin: 'left', animation: `${crecerX} 1.2s cubic-bezier(.3, .7, .2, 1) .4s backwards`, ...sinMovimiento }}
            >
              {partes.filter((p) => p.importe > 0).map((p) => (
                <Box key={p.estado} sx={{ flexGrow: p.importe, backgroundColor: p.color }} />
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
        etiqueta={`Saldo ${panel.dinero.ejercicio.anio}`}
        valor={<Valor valor={saldo} euros />}
        pie={saldo >= 0 ? 'superávit' : 'déficit'}
      >
        <Curva valores={saldoMes} color={saldo >= 0 ? graficas.entrada : graficas.salida} orden={3} />
      </Baldosa>
    </Box>
  )
}
