import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Box, Button, ButtonBase, Paper, Skeleton, Typography } from '@mui/material'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { panelTesoreria, type AdminReceiptStatus, type PanelTesoreria } from '../../../lib/api/tesoreria'
import { etiquetaMetodo, euros, fechaCorta } from '../contabilidad/formato'
import { tonoDeEstado } from './estados'

/** A dónde lleva cada cosa del resumen: una pestaña, y en la de recibos, con qué estado. */
export type Destino = { vista: 'recibos'; estado?: AdminReceiptStatus } | { vista: 'remesas' | 'impagos' | 'modelo182' }

interface Props {
  year: string
  /** Remesas y Modelo 182 son módulos: apagados, no se ofrecen. */
  conRemesas: boolean
  conModelo182: boolean
  onIr: (destino: Destino) => void
}

const porcentaje = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0)

/**
 * La entrada de Tesorería: cómo va el ejercicio y lo que toca hacer. Cada cifra
 * y cada tarea lleva a su listado, para que el resumen sea una puerta y no un
 * cuadro que mirar (así lo hacen los programas de cobros de las empresas).
 */
export default function PanelResumen({ year, conRemesas, conModelo182, onIr }: Props) {
  // Lo cargado lleva el año que se pidió: si ya es otro, aún no ha llegado y se pintan los huecos.
  const [cargado, setCargado] = useState<{ year: string; panel?: PanelTesoreria; error?: string } | null>(null)

  useEffect(() => {
    let vigente = true
    panelTesoreria(year)
      .then((datos) => { if (vigente) setCargado({ year, panel: datos }) })
      .catch((e: unknown) => { if (vigente) setCargado({ year, error: e instanceof Error ? e.message : 'No se ha podido cargar el resumen.' }) })
    return () => { vigente = false }
  }, [year])

  const vigente = cargado?.year === year ? cargado : null
  const panel = vigente?.panel ?? null
  if (vigente?.error) return <Alert severity="error">{vigente.error}</Alert>

  const e = panel?.estados
  const cifras: { clave: string; etiqueta: string; estado?: AdminReceiptStatus; total?: number; pie: string; destacada?: boolean }[] = panel && e ? [
    { clave: 'emitido', etiqueta: `Emitido en ${panel.year}`, total: panel.emitido.total, pie: `${panel.emitido.cuenta} recibos` },
    { clave: 'cobrado', etiqueta: 'Cobrado', estado: 'PAGADO', total: e.PAGADO.total, pie: `${porcentaje(e.PAGADO.total, panel.emitido.total)} % de lo emitido` },
    { clave: 'cobrar', etiqueta: 'Pendiente', estado: 'PENDIENTE', total: e.PENDIENTE.total, pie: `${e.PENDIENTE.cuenta} recibos`, destacada: e.PENDIENTE.cuenta > 0 },
    { clave: 'banco', etiqueta: 'En el banco', estado: 'REMESADO', total: e.REMESADO.total, pie: `${e.REMESADO.cuenta} recibos remesados` },
    { clave: 'devuelto', etiqueta: 'Devuelto', estado: 'DEVUELTO', total: e.DEVUELTO.total, pie: `${e.DEVUELTO.cuenta} recibos` },
  ] : []

  // La barra: lo emitido repartido por cómo está. Solo los cuatro estados que suman.
  const tramos = panel && e ? (['PAGADO', 'REMESADO', 'DEVUELTO', 'PENDIENTE'] as const).map((estado) => ({
    estado, ancho: porcentaje(e[estado].total, panel.emitido.total),
  })) : []

  const antiguedad = panel ? agruparAntiguedad(panel) : []
  const maxDeuda = Math.max(1, ...antiguedad.map((a) => a.total))
  const totalCobrado = panel ? panel.porMetodo.reduce((s, m) => s + m.total, 0) : 0
  const t = panel?.tareas

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Box role="group" aria-label={`Cifras de ${year}`} sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' } }}>
        {panel ? cifras.map((c) => {
          const tono = c.estado ? tonoDeEstado(c.estado) : null
          const contenido = (
            <>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875, fontSize: 13, color: 'text.secondary' }}>
                {tono && <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tono.texto }} />}
                {c.etiqueta}
              </Box>
              <Typography component="span" sx={{ fontSize: 26, fontWeight: 500, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>{euros(c.total ?? 0)}</Typography>
              <Typography component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>{c.pie}</Typography>
            </>
          )
          const caja = {
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, p: 2, borderRadius: 3, textAlign: 'left',
            backgroundColor: 'background.paper', border: 1, borderColor: c.destacada && tono ? tono.texto : 'divider', minWidth: 0,
          } as const
          return c.estado ? (
            <ButtonBase key={c.clave} onClick={() => onIr({ vista: 'recibos', estado: c.estado })} aria-label={`${c.etiqueta}: ${euros(c.total ?? 0)}, ${c.pie}. Ver los recibos`}
              sx={{ ...caja, '&:hover': { borderColor: tono?.texto }, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 } }}>
              {contenido}
            </ButtonBase>
          ) : <Box key={c.clave} sx={caja}>{contenido}</Box>
        }) : Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="rounded" height={104} />)}
      </Box>

      {panel && panel.emitido.total > 0 && (
        <Box role="img" aria-label={tramos.map((tr) => `${tr.ancho} % ${tr.estado === 'PAGADO' ? 'cobrado' : tr.estado === 'REMESADO' ? 'en el banco' : tr.estado === 'DEVUELTO' ? 'devuelto' : 'pendiente'}`).join(', ')}
          sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'action.hover', mt: -1 }}>
          {tramos.map((tr) => <Box key={tr.estado} sx={{ width: `${tr.ancho}%`, backgroundColor: tonoDeEstado(tr.estado).texto }} />)}
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Caja titulo="Lo que toca hacer">
            {!t ? <Skeleton variant="rounded" height={160} /> : (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {conRemesas && t.remesasCargadas.map((r) => (
                  <Tarea key={r.id} icono={<AccountBalanceOutlinedIcon />} tono="REMESADO"
                    titulo={`La remesa del ${fechaCorta(r.fechaCobro)} ya se ha cargado`}
                    detalle={`${r.enElBanco} recibos · ${euros(r.total)} siguen en el banco: dala por cobrada cuando veas el cargo.`}
                    accion={<Button variant="outlined" size="small" onClick={() => onIr({ vista: 'remesas' })}>Ir a la remesa</Button>} />
                ))}
                <Tarea icono={<PaymentsOutlinedIcon />} tono="PENDIENTE"
                  titulo={t.porCobrar.recibos === 0 ? `Nada pendiente de ${year}` : `${t.porCobrar.hermanos} ${t.porCobrar.hermanos === 1 ? 'hermano tiene' : 'hermanos tienen'} recibos pendientes de ${year}`}
                  detalle={t.porCobrar.recibos === 0 ? 'Todo lo emitido este año está cobrado, en el banco o resuelto.' : `${t.porCobrar.recibos} recibos · ${euros(t.porCobrar.total)}`}
                  accion={t.porCobrar.recibos > 0 ? <Button variant="outlined" size="small" onClick={() => onIr({ vista: 'recibos', estado: 'PENDIENTE' })}>Ver y cobrar</Button> : null} />
                <Tarea icono={<ErrorOutlineIcon />} tono="DEVUELTO"
                  titulo={t.impagos.hermanos === 0 ? 'Nadie debe cuotas de años anteriores' : `${t.impagos.hermanos} ${t.impagos.hermanos === 1 ? 'hermano debe' : 'hermanos deben'} cuotas de años anteriores`}
                  detalle={t.impagos.hermanos === 0 ? 'Sin impagos.' : `${euros(t.impagos.total)} en total`}
                  accion={t.impagos.hermanos > 0 ? <Button variant="outlined" size="small" onClick={() => onIr({ vista: 'impagos' })}>Ver impagos</Button> : null} />
                {conModelo182 && (
                  <Tarea icono={<DescriptionOutlinedIcon />} tono="ANULADO"
                    titulo={`Modelo 182 de ${year}`}
                    detalle="La declaración de donativos se presenta en enero; los certificados salen desde ahí."
                    accion={<Button size="small" onClick={() => onIr({ vista: 'modelo182' })}>Abrirlo</Button>} />
                )}
              </Box>
            )}
          </Caja>

          <Caja titulo="Últimos cobros" accion={<Button size="small" onClick={() => onIr({ vista: 'recibos', estado: 'PAGADO' })}>Ver todos</Button>}>
            {!panel ? <Skeleton variant="rounded" height={120} /> : panel.ultimosCobros.length === 0
              ? <Typography color="text.secondary" sx={{ fontSize: 14 }}>Todavía no se ha cobrado nada.</Typography>
              : (
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, '& th': { textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary', pb: 1 }, '& td': { py: 1, borderTop: 1, borderColor: 'divider', color: 'text.secondary' } }}>
                  <thead><tr><th>Día</th><th>Hermano</th><th>Concepto</th><th>Cómo</th><Box component="th" sx={{ textAlign: 'right !important' }}>Importe</Box></tr></thead>
                  <tbody>
                    {panel.ultimosCobros.map((c) => (
                      <tr key={c.id}>
                        <td>{fechaCorta(c.fechaPago)}</td>
                        <Box component="td" sx={{ color: 'text.primary !important' }}>{c.hermano.nombre} {c.hermano.apellidos}</Box>
                        <td>{c.concepto}</td>
                        <td>{etiquetaMetodo(c.metodoPago)}</td>
                        <Box component="td" sx={{ textAlign: 'right', color: 'text.primary !important', fontVariantNumeric: 'tabular-nums' }}>{euros(c.importe)}</Box>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              )}
          </Caja>
        </Box>

        <Box sx={{ display: 'grid', gap: 2 }}>
          <Caja titulo="Lo que se debe, por antigüedad" pie={panel ? `Pendiente y devuelto sin reemitir: ${euros(antiguedad.reduce((s, a) => s + a.total, 0))}` : undefined}>
            {!panel ? <Skeleton variant="rounded" height={90} /> : antiguedad.every((a) => a.total === 0)
              ? <Typography color="text.secondary" sx={{ fontSize: 14 }}>No se debe nada.</Typography>
              : <Barras filas={antiguedad.map((a, i) => ({ etiqueta: a.etiqueta, valor: a.total, texto: euros(a.total), color: ['#eda100', '#e3803c', '#e34948'][i] }))} maximo={maxDeuda} />}
          </Caja>
          <Caja titulo={`Cómo se ha cobrado en ${year}`}>
            {!panel ? <Skeleton variant="rounded" height={110} /> : panel.porMetodo.length === 0
              ? <Typography color="text.secondary" sx={{ fontSize: 14 }}>Sin cobros este año.</Typography>
              : <Barras filas={panel.porMetodo.map((m) => ({ etiqueta: etiquetaMetodo(m.metodo), valor: m.total, texto: `${porcentaje(m.total, totalCobrado)} %` }))} maximo={totalCobrado} />}
          </Caja>
        </Box>
      </Box>
    </Box>
  )
}

/** Lo que se debe en tres tramos: de este ejercicio, del anterior y de antes. */
function agruparAntiguedad(panel: PanelTesoreria) {
  const de = (filtro: (y: number) => boolean) => panel.antiguedad.filter((a) => filtro(a.year)).reduce((s, a) => s + a.total, 0)
  return [
    { etiqueta: `De ${panel.year}`, total: de((y) => y === panel.year) },
    { etiqueta: `De ${panel.year - 1}`, total: de((y) => y === panel.year - 1) },
    { etiqueta: `${panel.year - 2} y antes`, total: de((y) => y <= panel.year - 2) },
  ]
}

function Caja({ titulo, accion, pie, children }: { titulo: string; accion?: ReactNode; pie?: string; children: ReactNode }) {
  return (
    <Paper component="section" aria-label={titulo} sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: pie ? 0.25 : 1.25 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{titulo}</Typography>
        {accion}
      </Box>
      {pie && <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.5 }}>{pie}</Typography>}
      {children}
    </Paper>
  )
}

function Tarea({ icono, tono, titulo, detalle, accion }: { icono: ReactNode; tono: AdminReceiptStatus; titulo: string; detalle: string; accion: ReactNode }) {
  const color = tonoDeEstado(tono)
  return (
    <Box component="li" sx={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr) auto', gap: 1.75, alignItems: 'center', py: 1.5, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0, pt: 0.5 } }}>
      <Box aria-hidden="true" sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.texto, backgroundColor: color.fondo, '& svg': { fontSize: 19 } }}>{icono}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 500 }}>{titulo}</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>{detalle}</Typography>
      </Box>
      {accion}
    </Box>
  )
}

function Barras({ filas, maximo }: { filas: { etiqueta: string; valor: number; texto: string; color?: string }[]; maximo: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '108px minmax(0, 1fr) auto', gap: '10px 12px', alignItems: 'center', fontSize: 13.5 }}>
      {filas.map((f) => (
        <Box key={f.etiqueta} sx={{ display: 'contents' }}>
          <Typography component="span" sx={{ fontSize: 13.5, color: 'text.secondary' }}>{f.etiqueta}</Typography>
          <Box aria-hidden="true" sx={{ height: 10, borderRadius: 5, backgroundColor: 'action.hover', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${maximo > 0 ? Math.round((f.valor / maximo) * 100) : 0}%`, backgroundColor: f.color ?? 'text.secondary' }} />
          </Box>
          <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.texto}</Typography>
        </Box>
      ))}
    </Box>
  )
}
