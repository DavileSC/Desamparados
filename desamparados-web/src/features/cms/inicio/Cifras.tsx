import { useId, type ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { brillo } from '../../../theme/cms'
import { Degradado, Halo } from '../../../components/charts/brillo'
import { curvaSuave } from '../../../components/charts/ejes'
import { useAnchoMedido } from '../../../components/charts/useAnchoMedido'
import { etiquetaPunto, eurosResumen, numero } from '../contabilidad/formato'
import { contar } from './plural'
import { aparecerSuave, crecerX, crecerY, entrada, sinMovimiento, trazar, useCuenta } from './animaciones'
import { AZUL_GRAFICA, FILETE, ORO_GRAFICA, ROJO_GRAFICA, SERIF, VERDE, VERSALITAS } from './estiloRetablo'

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
function Area({ valores, color, orden, extremos }: {
  valores: number[]; color: string; orden: number
  /** Lo que se escribe bajo el primer y el último punto: «oct · 1.200 €». */
  extremos?: [string, string]
}) {
  const { graficas } = useTemaCms()
  const id = useId().replace(/:/g, '')
  // Se dibuja al ancho real de la baldosa: estirando una caja fija, el punto
  // final salía ovalado y la línea más gruesa en las subidas que en lo llano.
  const { referencia, ancho } = useAnchoMedido()
  if (valores.length < 2) return null
  // El mismo alto que las demás gráficas (--grafica), en cualquier pantalla.
  const alto = 44
  // Margen a los lados para que el halo del último punto no se corte.
  const margen = 8
  const min = Math.min(...valores), max = Math.max(...valores), rango = max - min || 1
  const puntos: [number, number][] = valores.map((v, i) => [margen + i * ((ancho - 2 * margen) / (valores.length - 1)), alto - 6 - ((v - min) / rango) * (alto - 18)])
  const d = curvaSuave(puntos)
  const [ux, uy] = puntos[puntos.length - 1]
  const retraso = `${300 + orden * 120}ms`
  return (
    <Box ref={referencia} sx={{ mt: 1.25 }}>
    <Box component="svg" viewBox={`0 0 ${ancho} ${alto}`} width="100%" height={alto} aria-hidden="true" sx={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <Degradado id={`area-${id}`} color={color} arriba={0.45} />
        <Halo id={`halo-${id}`} radio={3} />
      </defs>
      <Box component="path" d={`${d} L${puntos[puntos.length - 1][0]},${alto} L${margen},${alto} Z`} fill={`url(#area-${id})`} sx={{ animation: `${aparecerSuave} 1s ease-out backwards`, animationDelay: retraso, ...sinMovimiento }} />
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
      <circle cx={ux} cy={uy} r={7} fill={color} style={{ opacity: brillo(graficas.brillo, 0.4) }} />
      <circle cx={ux} cy={uy} r={3.5} fill={color} />
    </Box>
    {extremos && <Extremos izquierda={extremos[0]} derecha={extremos[1]} />}
    </Box>
  )
}

/** Las dos marcas de los extremos de una serie, bajo el dibujo. */
function Extremos({ izquierda, derecha }: { izquierda: string; derecha: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.5, fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
      <span>{izquierda}</span>
      <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{derecha}</Box>
    </Box>
  )
}

/**
 * Altas y bajas de cada mes, arriba y abajo de una raya: se ve en qué meses
 * entra la gente y en cuáles se va, que es lo que la cifra total no cuenta.
 */
function AltasYBajas({ meses, orden }: { meses: PanelResponse['censo']['movimientosMensuales']; orden: number }) {
  if (meses.length === 0) return null
  const tope = Math.max(1, ...meses.map((m) => Math.max(m.altas, m.bajas)))
  const barra = (valor: number, color: string, arriba: boolean, i: number) => (
    <Box
      sx={{
        width: '100%', height: `${(valor / tope) * 100}%`, minHeight: valor > 0 ? 2 : 0,
        borderRadius: arriba ? '2px 2px 0 0' : '0 0 2px 2px',
        backgroundImage: `linear-gradient(${arriba ? '180deg' : '0deg'}, ${color}, color-mix(in srgb, ${color} 35%, transparent))`,
        transformOrigin: arriba ? 'bottom' : 'top',
        animation: `${crecerY} .6s cubic-bezier(.2, .7, .2, 1) backwards`, animationDelay: `${350 + orden * 120 + i * 45}ms`, ...sinMovimiento,
      }}
    />
  )
  return (
    <Box sx={{ mt: 1.25 }}>
      <Box
        role="img"
        aria-label={`Altas y bajas por mes: ${meses.map((m) => `${etiquetaPunto(m.mes)}, ${m.altas} altas y ${m.bajas} bajas`).join('; ')}`}
        sx={{ display: 'grid', gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))`, columnGap: '3px' }}
      >
        {meses.map((m, i) => (
          <Box key={m.mes} sx={{ display: 'grid', gridTemplateRows: 'calc(var(--grafica) * .62) 1px calc(var(--grafica) * .38)' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>{barra(m.altas, ORO_GRAFICA, true, i)}</Box>
            <Box sx={{ backgroundColor: 'divider' }} />
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>{barra(m.bajas, ROJO_GRAFICA, false, i)}</Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mt: 0.5, fontSize: 12, color: 'text.secondary' }}>
        <span>{etiquetaPunto(meses[0].mes)}</span>
        <Box component="span" sx={{ display: 'inline-flex', gap: 1.25 }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><Box component="span" sx={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: ORO_GRAFICA }} />altas</Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><Box component="span" sx={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: ROJO_GRAFICA }} />bajas</Box>
        </Box>
        <span>{etiquetaPunto(meses[meses.length - 1].mes)}</span>
      </Box>
    </Box>
  )
}

/** Columnas con degradado, una por año, que crecen una tras otra; la del año en curso brilla. */
function Columnas({ valores, etiquetas, color, orden, corta }: { valores: number[]; etiquetas: string[]; color: string; orden: number; corta?: (etiqueta: string) => string }) {
  if (valores.length < 2) return null
  // Desde cero: si no, una diferencia pequeña entre años parecería enorme.
  const max = Math.max(1, ...valores)
  return (
    // Si la tarjeta es estrecha (dos por fila en el móvil), las etiquetas van
    // en corto («’22») para no salirse por la derecha.
    <Box aria-hidden="true" sx={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', mt: 1.25, containerType: 'inline-size',
      '& .corta': { display: 'none' },
      ...(corta && { '@container (max-width: 220px)': { '& .larga': { display: 'none' }, '& .corta': { display: 'inline' } } }),
    }}>
      {valores.map((v, i) => {
        const ultima = i === valores.length - 1
        return (
          <Box key={i} sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ height: 'calc(var(--grafica) * .9)', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Box
                sx={{
                  width: '100%', maxWidth: 26, height: `${Math.max(4, (v / max) * 100)}%`, borderRadius: '3px 3px 1px 1px',
                  backgroundImage: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 25%, transparent))`,
                  boxShadow: ultima ? `0 0 12px color-mix(in srgb, ${color} 40%, transparent)` : 'none',
                  opacity: ultima ? 1 : 0.55,
                  transformOrigin: 'bottom', animation: `${crecerY} .7s cubic-bezier(.2, .7, .2, 1) backwards`,
                  animationDelay: `${350 + orden * 120 + i * 70}ms`, ...sinMovimiento,
                }}
              />
            </Box>
            <Box component="span" sx={{ fontSize: 12, color: ultima ? 'text.primary' : 'text.secondary', fontWeight: ultima ? 700 : 400, whiteSpace: 'nowrap' }}>
              <span className="larga">{etiquetas[i]}</span>
              {corta && <span className="corta">{corta(etiquetas[i])}</span>}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

/** La diferencia con su signo: verde si sube, roja si baja. */
function Diferencia({ valor }: { valor: number }) {
  return (
    <Box component="span" sx={{ color: valor >= 0 ? VERDE : ROJO_GRAFICA, fontWeight: 600 }}>
      {valor >= 0 ? '+' : '−'}{numero(Math.abs(valor))}
    </Box>
  )
}

function Baldosa({ etiqueta, valor, pie, orden, children }: {
  etiqueta: string; valor: ReactNode; pie: ReactNode; orden: number; children?: ReactNode
}) {
  return (
    <Paper
      elevation={0}
      className="baldosa"
      sx={{
        p: 2, borderRadius: 2.5, border: `1px solid ${FILETE}`, backgroundColor: 'transparent', backgroundImage: 'none',
        display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0, height: '100%', containerType: 'inline-size', ...entrada(orden + 1),
      }}
    >
      <Typography className="etiqueta" sx={VERSALITAS}>{etiqueta}</Typography>
      <Typography className="valor" sx={{ ...SERIF, fontSize: 'min(20cqi, 38px)', lineHeight: 1, overflowWrap: 'anywhere' }}>
        {valor}
      </Typography>
      <Typography className="pie" sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pie}</Typography>
      {/* Lo gráfico va al fondo de la baldosa: así las cuatro alinean su pie. */}
      <Box className="grafica" sx={{ mt: 'auto' }}>{children}</Box>
    </Paper>
  )
}

/**
 * Las cuatro cifras de hoy, en baldosas a todo lo ancho del Inicio: son el
 * resumen de la casa, cada una con lo que la explica (su curva de doce meses o
 * de cinco años; lo por cobrar, repartido por estado).
 *
 * Van siempre sobre el ejercicio en curso: los años cerrados se miran en
 * «Datos e informes».
 */
export default function Cifras({ panel }: { panel: PanelResponse }) {
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

  const saldo = panel.dinero.ejercicio.saldo
  // La curva recorre el mismo ejercicio que la cifra: del 1 de enero (0 €) al
  // cierre de cada mes. La serie mensual trae doce meses hacia atrás, y
  // acumulándola entera la curva acababa en otro número que el de la baldosa.
  const anioSaldo = panel.dinero.ejercicio.anio
  const mesesDelEjercicio = panel.dinero.serieMensual.filter((m) => m.mes.startsWith(`${anioSaldo}-`))
  const saldoMes = mesesDelEjercicio.reduce<number[]>(
    (serie, m) => [...serie, Math.round(((serie.at(-1) ?? 0) + m.ingresos - m.gastos) * 100) / 100],
    [0],
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
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        '@container cifras (min-width: 640px)': { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
        // Las gráficas, siempre del mismo alto: las cifras van a todo lo ancho
        // bajo el retablo y el hueco que cambia con la pantalla es el del curso.
        '--grafica': '44px',
        // Solo en pantallas de verdad bajas se van.
        '@media (max-height: 560px)': { '& .grafica': { display: 'none' } },
        // En el móvil, las cuatro en una fila y solo la cifra.
        '@container cifras (max-width: 599px)': {
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px',
          '& .baldosa': { p: 1, gap: 0.5 },
          '& .etiqueta': { fontSize: 9.5, letterSpacing: '0.04em' },
          '& .valor': { fontSize: 'clamp(15px, 13cqi, 22px)' },
          '& .pie, & .grafica': { display: 'none' },
        },
      }}
    >
      <Baldosa
        orden={0}
        etiqueta="Hermanos activos"
        valor={<Valor valor={panel.censo.activos} />}
        pie={<><Diferencia valor={netos} /> en doce meses · {numero(panel.censo.altas12m)} / −{numero(panel.censo.bajas12m)}</>}
      >
        <AltasYBajas meses={panel.censo.movimientosMensuales} orden={0} />
      </Baldosa>
      <Baldosa
        orden={1}
        etiqueta={`Papeletas ${panel.procesion.anio}`}
        valor={<Valor valor={panel.procesion.papeletas} />}
        pie={anterior && diferencia !== null ? <><Diferencia valor={diferencia} /> sobre las {numero(anterior.total)} de {anterior.anio}</> : 'de sitio'}
      >
        <Columnas valores={anios.map((a) => a.total)} etiquetas={anios.map((a) => String(a.anio))} corta={(anio) => `’${anio.slice(-2)}`} color={ORO_GRAFICA} orden={1} />
      </Baldosa>
      <Baldosa
        orden={2}
        etiqueta={`Por cobrar ${panel.dinero.ejercicio.anio}`}
        valor={<Valor valor={porCobrar.importe} euros />}
        pie={<>
          {contar(porCobrar.total, 'recibo', 'recibos')}
          {/* Lo de otros años también se debe: dicho aquí, esta cifra y la de Contabilidad (todos los años) cuadran. */}
          {!!anteriores?.importe && <> · y {eurosResumen(anteriores.importe)} de años anteriores</>}
        </>}
      >
        {porCobrar.importe > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Box
              role="img"
              aria-label={partes.filter((p) => p.importe > 0).map((p) => `${p.texto}: ${eurosResumen(p.importe)}`).join(', ')}
              sx={{ display: 'flex', gap: '2px', height: 8, borderRadius: 1, overflow: 'hidden', transformOrigin: 'left', animation: `${crecerX} 1.2s cubic-bezier(.3, .7, .2, 1) .4s backwards`, ...sinMovimiento }}
            >
              {partes.filter((p) => p.importe > 0).map((p) => (
                <Box key={p.estado} sx={{ flexGrow: p.importe, backgroundColor: p.color }} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', mt: 0.75, fontSize: 12.5, color: 'text.secondary' }}>
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
        pie={saldo >= 0 ? 'Superávit' : 'Déficit'}
      >
        <Area
          valores={saldoMes}
          color={saldo >= 0 ? ORO_GRAFICA : ROJO_GRAFICA}
          orden={3}
          extremos={mesesDelEjercicio.length > 0
            ? ['1 ene · 0 €', `${etiquetaPunto(mesesDelEjercicio[mesesDelEjercicio.length - 1].mes)} · ${eurosResumen(saldoMes[saldoMes.length - 1])}`]
            : undefined}
        />
      </Baldosa>
    </Box>
  )
}
