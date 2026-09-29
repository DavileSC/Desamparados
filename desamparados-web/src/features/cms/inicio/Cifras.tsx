import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { brillo } from '../../../theme/cms'
import { Degradado, Halo } from '../../../components/charts/brillo'
import { curvaSuave } from '../../../components/charts/ejes'
import { etiquetaPunto, eurosResumen, numero } from '../contabilidad/formato'
import { contar } from './plural'
import { aparecerSuave, crecerX, crecerY, entrada, sinMovimiento, trazar, useCuenta } from './animaciones'
import { AZUL_GRAFICA, FILETE, FILETE_SUAVE, FONDO_PIEZA, ORO, ORO_GRAFICA, ROJO_GRAFICA, SERIF, VERDE, VERSALITAS } from './estiloRetablo'

/** La cifra grande, contando desde cero. */
function Valor({ valor, euros = false }: { valor: number; euros?: boolean }) {
  const actual = useCuenta(valor)
  return <>{euros ? eurosResumen(actual) : numero(Math.round(actual))}</>
}

/** La diferencia con su signo: verde si sube, roja si baja. */
function Diferencia({ valor }: { valor: number }) {
  return (
    <Box component="span" sx={{ color: valor >= 0 ? VERDE : ROJO_GRAFICA, fontWeight: 600 }}>
      {valor >= 0 ? '+' : '−'}{numero(Math.abs(valor))}
    </Box>
  )
}

function Muestra({ color, children }: { color: string; children: ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: '2px', flexShrink: 0, backgroundColor: color }} />
      {children}
    </Box>
  )
}

const Vacio = ({ children }: { children: ReactNode }) => (
  <Typography sx={{ m: 'auto', fontSize: 14, color: 'text.secondary' }}>{children}</Typography>
)

/** Un número pequeño sobre o bajo su barra. */
const rotulo = { fontSize: 11.5, color: 'text.secondary', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', textAlign: 'center' } as const

/**
 * Altas arriba y bajas abajo de una raya, cada mes con su número: se ve en qué
 * meses entra la gente y en cuáles se va. Arriba y abajo miden en la misma
 * escala: cada mitad es tan alta como su mes mayor.
 */
function AltasYBajas({ meses }: { meses: PanelResponse['censo']['movimientosMensuales'] }) {
  if (meses.length === 0) return <Vacio>Todavía no hay altas ni bajas que contar.</Vacio>
  const maxAltas = Math.max(1, ...meses.map((m) => m.altas))
  const maxBajas = Math.max(maxAltas * 0.15, ...meses.map((m) => m.bajas))
  const barra = (valor: number, tope: number, color: string, arriba: boolean, i: number) => (
    <Box
      sx={{
        width: '64%', mx: 'auto', height: `${(valor / tope) * 82}%`, minHeight: valor > 0 ? 2 : 0,
        borderRadius: arriba ? '3px 3px 0 0' : '0 0 3px 3px',
        backgroundImage: `linear-gradient(${arriba ? '180deg' : '0deg'}, ${color}, color-mix(in srgb, ${color} 40%, transparent))`,
        opacity: i === meses.length - 1 ? 1 : 0.8,
        transformOrigin: arriba ? 'bottom' : 'top',
        animation: `${crecerY} .6s cubic-bezier(.2, .7, .2, 1) backwards`, animationDelay: `${150 + i * 40}ms`, ...sinMovimiento,
      }}
    />
  )
  return (
    <Box
      role="img"
      aria-label={`Altas y bajas por mes: ${meses.map((m) => `${etiquetaPunto(m.mes)}, ${m.altas} altas y ${m.bajas} bajas`).join('; ')}`}
      sx={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))`, gridTemplateRows: `minmax(0, ${maxAltas}fr) 1px minmax(0, ${maxBajas}fr) auto` }}
    >
      {meses.map((m, i) => (
        <Box key={`a-${m.mes}`} sx={{ gridRow: 1, gridColumn: i + 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 0 }}>
          <Box aria-hidden="true" sx={rotulo}>{m.altas || ''}</Box>
          {barra(m.altas, maxAltas, ORO_GRAFICA, true, i)}
        </Box>
      ))}
      <Box sx={{ gridRow: 2, gridColumn: '1 / -1', backgroundColor: 'divider' }} />
      {meses.map((m, i) => (
        <Box key={`b-${m.mes}`} sx={{ gridRow: 3, gridColumn: i + 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {barra(m.bajas, maxBajas, ROJO_GRAFICA, false, i)}
          <Box aria-hidden="true" sx={{ ...rotulo, color: ROJO_GRAFICA }}>{m.bajas ? `−${m.bajas}` : ''}</Box>
        </Box>
      ))}
      {meses.map((m, i) => (
        <Box key={`m-${m.mes}`} aria-hidden="true" sx={{ gridRow: 4, gridColumn: i + 1, ...rotulo, pt: 0.75, ...(i === meses.length - 1 && { color: 'text.primary', fontWeight: 600 }) }}>
          {etiquetaPunto(m.mes).split(' ')[0]}
        </Box>
      ))}
    </Box>
  )
}

/** Una columna por año con su total; la del año en curso brilla. */
function PorAnio({ anios }: { anios: PanelResponse['procesion']['porAnio'] }) {
  if (anios.length === 0) return <Vacio>Todavía no hay papeletas de ningún año.</Vacio>
  // Desde cero: si no, una diferencia pequeña entre años parecería enorme.
  const max = Math.max(1, ...anios.map((a) => a.total))
  return (
    <Box
      role="img"
      aria-label={`Papeletas por año: ${anios.map((a) => `${a.anio}, ${a.total}`).join('; ')}`}
      sx={{ flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'stretch', gap: 2 }}
    >
      {anios.map((a, i) => {
        const ultima = i === anios.length - 1
        return (
          <Box key={a.anio} sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Box aria-hidden="true" sx={{ ...rotulo, fontSize: 13, ...(ultima && { color: 'text.primary', fontWeight: 600 }) }}>{numero(a.total)}</Box>
            <Box
              sx={{
                width: '100%', maxWidth: 56, height: `${Math.max(2, (a.total / max) * 82)}%`, borderRadius: '4px 4px 1px 1px',
                backgroundImage: `linear-gradient(180deg, ${ORO_GRAFICA}, color-mix(in srgb, ${ORO_GRAFICA} 25%, transparent))`,
                boxShadow: ultima ? `0 0 16px color-mix(in srgb, ${ORO_GRAFICA} 40%, transparent)` : 'none',
                opacity: ultima ? 1 : 0.55, transformOrigin: 'bottom',
                animation: `${crecerY} .7s cubic-bezier(.2, .7, .2, 1) backwards`, animationDelay: `${150 + i * 70}ms`, ...sinMovimiento,
              }}
            />
            <Box aria-hidden="true" sx={{ ...rotulo, fontSize: 12.5, pt: 0.75, ...(ultima && { color: 'text.primary', fontWeight: 700 }) }}>{a.anio}</Box>
          </Box>
        )
      })}
    </Box>
  )
}

interface Parte { estado: string; texto: string; color: string; total: number; importe: number }

/** Lo que queda por cobrar, repartido: la barra entera y, debajo, cada parte con sus recibos y su importe. */
function Reparto({ partes, anteriores }: { partes: Parte[]; anteriores?: { total: number; importe: number } }) {
  const conImporte = partes.filter((p) => p.importe > 0)
  if (conImporte.length === 0) return <Vacio>No queda nada por cobrar de este ejercicio.</Vacio>
  return (
    <Box sx={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
      <Box
        role="img"
        aria-label={conImporte.map((p) => `${p.texto}: ${eurosResumen(p.importe)}`).join(', ')}
        sx={{ display: 'flex', gap: '3px', height: 'clamp(16px, 4vh, 28px)', borderRadius: 1.5, overflow: 'hidden', transformOrigin: 'left', animation: `${crecerX} 1.2s cubic-bezier(.3, .7, .2, 1) .2s backwards`, ...sinMovimiento }}
      >
        {conImporte.map((p) => <Box key={p.estado} sx={{ flexGrow: p.importe, backgroundColor: p.color }} />)}
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {partes.map((p) => (
          <Box component="li" key={p.estado} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 2, alignItems: 'baseline', py: 'clamp(4px, 1vh, 9px)', borderTop: `1px solid ${FILETE_SUAVE}`, fontSize: 14 }}>
            <Muestra color={p.color}>{p.texto}</Muestra>
            <Box component="span" sx={{ color: 'text.secondary', fontSize: 13 }}>{contar(p.total, 'recibo', 'recibos')}</Box>
            <Box component="span" sx={{ ...SERIF, fontSize: 20, minWidth: 90, textAlign: 'right' }}>{eurosResumen(p.importe)}</Box>
          </Box>
        ))}
      </Box>
      {!!anteriores?.importe && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          Y {eurosResumen(anteriores.importe)} de años anteriores ({contar(anteriores.total, 'recibo', 'recibos')}), que se cuentan aparte.
        </Typography>
      )}
    </Box>
  )
}

/** El ancho y el alto reales del hueco: la curva se dibuja a su tamaño, sin estirarse. */
function useTamano() {
  const referencia = useRef<HTMLDivElement>(null)
  const [tamano, setTamano] = useState({ ancho: 560, alto: 180 })
  useEffect(() => {
    const nodo = referencia.current
    if (!nodo || typeof ResizeObserver === 'undefined') return
    const medir = () => {
      if (nodo.clientWidth > 0 && nodo.clientHeight > 0) setTamano({ ancho: nodo.clientWidth, alto: nodo.clientHeight })
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])
  return { referencia, ...tamano }
}

/** El saldo acumulado del ejercicio, del 1 de enero (0 €) al cierre de cada mes. */
function CurvaDelSaldo({ valores, meses, color }: { valores: number[]; meses: string[]; color: string }) {
  const { graficas } = useTemaCms()
  const id = useId().replace(/:/g, '')
  const { referencia, ancho, alto } = useTamano()
  if (valores.length < 2) return <Vacio>Todavía no hay apuntes este año.</Vacio>
  const margen = 10
  const min = Math.min(0, ...valores), max = Math.max(0, ...valores), rango = max - min || 1
  const y = (v: number) => alto - 8 - ((v - min) / rango) * (alto - 26)
  const puntos: [number, number][] = valores.map((v, i) => [margen + i * ((ancho - 2 * margen) / (valores.length - 1)), y(v)])
  const d = curvaSuave(puntos)
  const [ux, uy] = puntos[puntos.length - 1]
  return (
    <Box sx={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box ref={referencia} sx={{ flex: '1 1 0', minHeight: 0 }}>
        <Box component="svg" viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} aria-hidden="true" sx={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <Degradado id={`area-${id}`} color={color} arriba={0.4} />
            <Halo id={`halo-${id}`} radio={3} />
          </defs>
          {min < 0 && <line x1={0} x2={ancho} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 4" />}
          <Box component="path" d={`${d} L${ux},${alto} L${margen},${alto} Z`} fill={`url(#area-${id})`} sx={{ animation: `${aparecerSuave} 1s ease-out .3s backwards`, ...sinMovimiento }} />
          <path d={d} fill="none" stroke={color} strokeWidth={4} filter={`url(#halo-${id})`} opacity={graficas.brillo} />
          <Box component="path" d={d} pathLength={1} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="1" sx={{ animation: `${trazar} 1.3s ease-out .2s backwards`, ...sinMovimiento }} />
          <circle cx={ux} cy={uy} r={8} fill={color} style={{ opacity: brillo(graficas.brillo, 0.4) }} />
          <circle cx={ux} cy={uy} r={4} fill={color} />
        </Box>
      </Box>
      <Box aria-hidden="true" sx={{ display: 'flex', justifyContent: 'space-between', px: `${margen - 6}px`, pt: 0.75, ...rotulo }}>
        {meses.map((m, i) => <span key={i}>{m}</span>)}
      </Box>
    </Box>
  )
}

/**
 * Las cuatro cifras de la casa: a la izquierda, en columna, para elegir; a la
 * derecha, la elegida en grande con su gráfica y lo que la explica. Van
 * siempre sobre el ejercicio en curso: los años cerrados se miran en «Datos e
 * informes».
 */
export default function Cifras({ panel }: { panel: PanelResponse }) {
  const [elegida, setElegida] = useState(0)
  const idPanel = useId()
  const netos = panel.censo.altas12m - panel.censo.bajas12m

  // REMESADO cuenta como «por cobrar»: es dinero ya enviado al banco en un
  // lote SEPA, pero todavía no está en la cuenta.
  const PARTES = [
    { estado: 'PENDIENTE', texto: 'Pendiente', color: ORO_GRAFICA },
    { estado: 'REMESADO', texto: 'En el banco', color: AZUL_GRAFICA },
    { estado: 'DEVUELTO', texto: 'Devuelto', color: ROJO_GRAFICA },
  ] as const
  const partes = PARTES.map((p) => {
    // De los devueltos, solo los que no se han reemitido: el reemitido ya cuenta como su recibo nuevo.
    const fila = p.estado === 'DEVUELTO' ? panel.dinero.devueltosPendientes : panel.dinero.porEstado.find((e) => e.estado === p.estado)
    return { ...p, total: fila?.total ?? 0, importe: fila?.importe ?? 0 }
  })
  const anteriores = panel.dinero.anterioresPorCobrar
  const porCobrar = partes.reduce((s, e) => ({ total: s.total + e.total, importe: s.importe + e.importe }), { total: 0, importe: 0 })

  const { ejercicio } = panel.dinero
  // La curva recorre el mismo ejercicio que la cifra: del 1 de enero (0 €) al
  // cierre de cada mes. La serie mensual trae doce meses hacia atrás, y
  // acumulándola entera la curva acababa en otro número que el de la cifra.
  const mesesDelEjercicio = panel.dinero.serieMensual.filter((m) => m.mes.startsWith(`${ejercicio.anio}-`))
  const saldoMes = mesesDelEjercicio.reduce<number[]>(
    (serie, m) => [...serie, Math.round(((serie.at(-1) ?? 0) + m.ingresos - m.gastos) * 100) / 100],
    [0],
  )
  const ultimoMes = mesesDelEjercicio.at(-1)

  const anios = panel.procesion.porAnio
  const anterior = anios.find((a) => a.anio === panel.procesion.anio - 1)
  const diferencia = anterior ? panel.procesion.papeletas - anterior.total : null

  const cifras = [
    {
      etiqueta: 'Hermanos activos',
      valor: <Valor valor={panel.censo.activos} />,
      titulo: 'Altas y bajas, mes a mes',
      resumen: <><Diferencia valor={netos} /> en doce meses · {contar(panel.censo.altas12m, 'alta', 'altas')}, {contar(panel.censo.bajas12m, 'baja', 'bajas')}</>,
      leyenda: <><Muestra color={ORO_GRAFICA}>altas</Muestra><Muestra color={ROJO_GRAFICA}>bajas</Muestra></>,
      grafica: <AltasYBajas meses={panel.censo.movimientosMensuales} />,
    },
    {
      etiqueta: `Papeletas ${panel.procesion.anio}`,
      valor: <Valor valor={panel.procesion.papeletas} />,
      titulo: 'Papeletas de sitio, año a año',
      resumen: anterior && diferencia !== null ? <><Diferencia valor={diferencia} /> sobre las {numero(anterior.total)} de {anterior.anio}</> : 'Papeletas de sitio sacadas este año',
      grafica: <PorAnio anios={anios} />,
    },
    {
      etiqueta: `Por cobrar ${ejercicio.anio}`,
      valor: <Valor valor={porCobrar.importe} euros />,
      titulo: 'Lo que queda por cobrar',
      resumen: contar(porCobrar.total, 'recibo', 'recibos'),
      grafica: <Reparto partes={partes} anteriores={anteriores} />,
    },
    {
      etiqueta: `Saldo ${ejercicio.anio}`,
      valor: <Valor valor={ejercicio.saldo} euros />,
      titulo: 'El saldo del año, mes a mes',
      resumen: <>{ejercicio.saldo >= 0 ? 'Superávit' : 'Déficit'} · {eurosResumen(ejercicio.ingresos)} de ingresos, {eurosResumen(ejercicio.gastos)} de gastos</>,
      leyenda: ultimoMes ? <><span>1 ene · 0 €</span><Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{`${etiquetaPunto(ultimoMes.mes)} · ${eurosResumen(saldoMes[saldoMes.length - 1])}`}</Box></> : undefined,
      grafica: <CurvaDelSaldo valores={saldoMes} meses={['', ...mesesDelEjercicio.map((m) => etiquetaPunto(m.mes).split(' ')[0])]} color={ejercicio.saldo >= 0 ? ORO_GRAFICA : ROJO_GRAFICA} />,
    },
  ]
  const actual = cifras[elegida]

  return (
    <Box
      component="section"
      aria-label="Cifras de hoy"
      sx={{
        flex: '1 1 0', minHeight: 0, display: 'flex', containerType: 'inline-size', containerName: 'cifras',
        // En el móvil la pestaña se desplaza: mide lo que lleva.
        '@container columna (max-width: 559px)': { flex: '1 0 auto' },
      }}
    >
      <Box
        sx={{
          flex: 1, minHeight: 0, display: 'grid', gap: 'clamp(8px, 1.6vh, 14px)',
          gridTemplateColumns: 'minmax(170px, 210px) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)',
          // En el móvil, las cuatro en una fila arriba y la gráfica debajo.
          '@container cifras (max-width: 599px)': {
            gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'auto minmax(0, 1fr)',
            '& .selector': { gridTemplateRows: 'none', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' },
            '& .selector button': { px: 1, py: 0.75 },
            '& .selector .etiqueta': { fontSize: 9, letterSpacing: '0.04em' },
            '& .selector .valor': { fontSize: 'clamp(15px, 5cqi, 22px)' },
            // La pestaña se desplaza en el móvil: la gráfica necesita un alto propio.
            '& .elegida': { minHeight: 300 },
          },
        }}
      >
        <Box className="selector" sx={{ minHeight: 0, display: 'grid', gridTemplateRows: 'repeat(4, minmax(0, 1fr))', gap: 1 }}>
          {cifras.map((c, i) => {
            const activa = i === elegida
            return (
              <Box
                key={c.etiqueta}
                component="button"
                type="button"
                aria-pressed={activa}
                aria-controls={idPanel}
                onClick={() => setElegida(i)}
                sx={{
                  minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.25,
                  px: 2, py: 1, m: 0, borderRadius: 2, textAlign: 'left', fontFamily: 'inherit', color: 'text.primary', cursor: 'pointer',
                  border: '1px solid', borderColor: activa ? `color-mix(in srgb, ${ORO} 60%, transparent)` : FILETE,
                  backgroundColor: activa ? `color-mix(in srgb, ${ORO} 9%, transparent)` : 'transparent',
                  '&:hover': { borderColor: `color-mix(in srgb, ${ORO} 45%, transparent)` },
                  '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
                  ...entrada(i + 1),
                }}
              >
                <Box component="span" className="etiqueta" sx={{ ...VERSALITAS, fontSize: 10.5, color: activa ? ORO : 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.etiqueta}</Box>
                <Box component="span" className="valor" sx={{ ...SERIF, fontSize: 'clamp(24px, 4.6vh, 32px)', lineHeight: 1, whiteSpace: 'nowrap' }}>{c.valor}</Box>
              </Box>
            )
          })}
        </Box>

        <Box
          id={idPanel}
          className="elegida"
          aria-live="polite"
          sx={{
            minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.75,
            px: 'clamp(14px, 2vw, 24px)', py: 'clamp(10px, 2vh, 18px)', borderRadius: 2.5, border: `1px solid ${FILETE}`, backgroundColor: FONDO_PIEZA,
            '& > *': { flexShrink: 0 },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2px 16px', flexWrap: 'wrap' }}>
            <Typography component="h3" sx={{ ...SERIF, fontSize: 'clamp(19px, 3vh, 24px)', lineHeight: 1.15 }}>{actual.titulo}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{actual.resumen}</Typography>
          </Box>
          {actual.leyenda && (
            <Box sx={{ display: 'flex', justifyContent: elegida === 3 ? 'space-between' : 'flex-start', gap: 2, fontSize: 12.5, color: 'text.secondary', order: elegida === 3 ? 3 : 0 }}>
              {actual.leyenda}
            </Box>
          )}
          <Box key={elegida} sx={{ flex: '1 1 0 !important', minHeight: 0, display: 'flex', flexDirection: 'column', pt: 1.5 }}>
            {actual.grafica}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
