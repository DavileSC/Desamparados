import { useEffect, useState } from 'react'
import { Box, Button, Divider, Drawer, IconButton, Link as EnlaceMui, Skeleton, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { Link } from 'react-router-dom'
import {
  historialRecibo, recibosDelCms,
  type AdminReceipt, type AdminReceiptStatus, type LineaHistorial, type ReceiptType,
} from '../../../lib/api/tesoreria'
import { etiquetaMetodo, euros, fechaCorta } from '../contabilidad/formato'
import SelloEstado from './SelloEstado'
import { ESTADOS_RECIBO, accionDeCambio, cambiosDe, papeletaPorResolver } from './estados'

const TIPOS: Record<ReceiptType, string> = { CUOTA_HERMANO: 'Cuota de hermano', PAPELETA_SITIO: 'Papeleta de sitio', DONATIVO: 'Donativo', OTRO: 'Otro' }

interface Props {
  recibo: AdminReceipt | null
  ocupado: boolean
  onCerrar: () => void
  /** Abre «Registrar cobro» con estos recibos. */
  onCobrar: (recibos: AdminReceipt[]) => void
  /** Un remesado: el banco lo cobró, se confirma por domiciliación. */
  onConfirmar: (recibo: AdminReceipt) => void
  onReemitir: (recibo: AdminReceipt) => void
  onCambiarEstado: (recibo: AdminReceipt, destino: AdminReceiptStatus) => void
  /** Solo el Hermano Mayor (y Administración): una papeleta devuelta que no se va a cobrar. */
  onDarPorPerdida?: (recibo: AdminReceipt) => void
}

/** Una línea del historial en palabras: qué pasó, no el nombre de la acción. */
function queHizo(l: LineaHistorial): string {
  if (l.accion === 'RECIBO_COBRAR') return `Cobrado${l.metodoPago ? ` · ${etiquetaMetodo(l.metodoPago)}` : ''}`
  if (l.accion === 'RECIBO_EMITIR') return 'Emitido'
  if (l.accion === 'RECIBO_PERDONAR') return 'Perdonado'
  if (l.estado) return `Pasa a ${ESTADOS_RECIBO[l.estado].etiqueta.toLowerCase()}`
  return 'Modificado'
}

/**
 * La ficha de un recibo, al lado del listado: lo que es, de quién, qué se ha
 * hecho con él y lo que se puede hacer ahora. Si el hermano tiene más cosas
 * pendientes, lo dice y ofrece cobrarlas a la vez, que es lo que se hace
 * cuando alguien viene a pagar.
 */
export default function FichaRecibo({ recibo, ocupado, onCerrar, onCobrar, onConfirmar, onReemitir, onCambiarEstado, onDarPorPerdida }: Props) {
  // Lo cargado lleva el recibo al que pertenece: abierto otro, lo de antes no se enseña.
  const [historialDe, setHistorialDe] = useState<{ id: number; historial: LineaHistorial[]; observaciones: string | null } | null>(null)
  const [pendientesDe, setPendientesDe] = useState<{ id: number; recibos: AdminReceipt[] } | null>(null)

  useEffect(() => {
    if (!recibo) return
    let vigente = true
    historialRecibo(recibo.id)
      .then((h) => { if (vigente) setHistorialDe({ id: recibo.id, ...h }) })
      .catch(() => { if (vigente) setHistorialDe({ id: recibo.id, historial: [], observaciones: null }) })
    recibosDelCms(undefined, { pagina: 1, porPagina: 100 }, { hermano: String(recibo.hermano.id), estado: 'PENDIENTE', orden: 'antiguos' })
      .then((r) => { if (vigente) setPendientesDe({ id: recibo.id, recibos: r.data }) })
      .catch(() => { if (vigente) setPendientesDe({ id: recibo.id, recibos: [] }) })
    return () => { vigente = false }
  }, [recibo])

  const r = recibo
  const historial = r && historialDe?.id === r.id ? historialDe.historial : null
  const observaciones = r && historialDe?.id === r.id ? historialDe.observaciones : null
  const pendientes = r && pendientesDe?.id === r.id ? pendientesDe.recibos : []
  const otros = r ? pendientes.filter((p) => p.id !== r.id) : []
  const todos = r && r.estado === 'PENDIENTE' ? [r, ...otros] : otros
  const totalTodos = todos.reduce((s, x) => s + Number(x.importe), 0)
  const reemitible = r?.estado === 'DEVUELTO' && !r.reemitido && r.tipo !== 'PAPELETA_SITIO'
  const conApuntes = r && (r.estado === 'PAGADO' || r.estado === 'DEVUELTO' || r.estado === 'REEMBOLSADO')

  return (
    <Drawer anchor="right" open={r !== null} onClose={onCerrar}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, p: { xs: 2.5, sm: 3.5 }, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' } } }}>
      {r && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Typography sx={{ fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>Recibo n.º {r.id}</Typography>
            <SelloEstado estado={r.estado} />
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={onCerrar} aria-label="Cerrar la ficha"><CloseIcon /></IconButton>
          </Box>
          <Typography component="h2" sx={{ fontSize: 32, fontWeight: 500, mt: 1, fontVariantNumeric: 'tabular-nums', textDecoration: r.estado === 'ANULADO' ? 'line-through' : 'none' }}>
            {euros(Number(r.importe))}
          </Typography>
          <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>{r.concepto}</Typography>

          <Box component="dl" sx={{ m: 0, mt: 2.5, '& > div': { display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, borderTop: 1, borderColor: 'divider', fontSize: 14 }, '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right' } }}>
            <div><dt>Hermano</dt><dd>{r.hermano.nombre} {r.hermano.apellidos}{r.hermano.numeroHermano !== null && ` · n.º ${r.hermano.numeroHermano}`}</dd></div>
            {r.tipo && <div><dt>Tipo</dt><dd>{TIPOS[r.tipo]}</dd></div>}
            <div><dt>Ejercicio</dt><dd>{r.year}</dd></div>
            <div><dt>Emitido</dt><dd>{fechaCorta(r.fechaEmision)}</dd></div>
            {r.fechaPago && <div><dt>Cobrado</dt><dd>{fechaCorta(r.fechaPago)}{r.metodoPago && ` · ${etiquetaMetodo(r.metodoPago)}`}</dd></div>}
            {r.remesaId !== null && <div><dt>Remesa</dt><dd>n.º {r.remesaId}</dd></div>}
            {otros.length > 0 && <div><dt>Tiene además</dt><dd>{otros.length === 1 ? '1 recibo pendiente' : `${otros.length} recibos pendientes`} ({euros(otros.reduce((s, x) => s + Number(x.importe), 0))})</dd></div>}
          </Box>
          {observaciones && <Typography sx={{ mt: 1.5, fontSize: 13.5, color: 'text.secondary', whiteSpace: 'pre-line' }}>{observaciones}</Typography>}

          <Typography component="h3" sx={{ mt: 3, mb: 1.25, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>Historial</Typography>
          {historial === null ? <Skeleton variant="rounded" height={60} /> : (
            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
              {/* La emisión no siempre deja línea (la generación de cuotas apunta una por tanda): sale de la fecha del recibo. */}
              {!historial.some((l) => l.accion === 'RECIBO_EMITIR') && (
                <Box component="li" sx={{ fontSize: 13.5 }}><b>Emitido</b> · {fechaCorta(r.fechaEmision)}</Box>
              )}
              {historial.map((l) => (
                <Box component="li" key={l.id} sx={{ fontSize: 13.5 }}>
                  <b>{queHizo(l)}</b> · {fechaCorta(l.fecha)}{l.quien && <Box component="span" sx={{ color: 'text.secondary' }}>, por {l.quien}</Box>}
                  {l.nota && <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>{l.nota}</Box>}
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ flex: 1, minHeight: 24 }} />
          <Stack spacing={1.25}>
            {r.estado === 'PENDIENTE' && (
              <Button variant="contained" size="large" disabled={ocupado} onClick={() => onCobrar([r])}>Registrar cobro de {euros(Number(r.importe))}</Button>
            )}
            {todos.length > 1 && (
              <Button variant="outlined" size="large" disabled={ocupado} onClick={() => onCobrar(todos)}>
                Cobrar sus {todos.length} recibos · {euros(totalTodos)}
              </Button>
            )}
            {r.estado === 'REMESADO' && (
              <Button variant="contained" size="large" disabled={ocupado} onClick={() => onConfirmar(r)}>Confirmar que el banco lo cobró</Button>
            )}
            {reemitible && <Button variant="outlined" size="large" disabled={ocupado} onClick={() => onReemitir(r)}>Reemitir</Button>}
            {papeletaPorResolver(r) && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Una papeleta no se reemite desde aquí: se cobra en la mesa de reparto cuando vuelva el hermano.
              </Typography>
            )}
            {onDarPorPerdida && papeletaPorResolver(r) && (
              <Button variant="outlined" size="large" disabled={ocupado} onClick={() => onDarPorPerdida(r)}>Darla por perdida</Button>
            )}
            {cambiosDe(r).length > 0 && (
              <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                {cambiosDe(r).map((destino) => (
                  <Button key={destino} disabled={ocupado} onClick={() => onCambiarEstado(r, destino)} sx={{ flex: '1 1 0', bgcolor: 'action.hover' }}>
                    {accionDeCambio(destino)}
                  </Button>
                ))}
              </Box>
            )}
            {conApuntes && (
              <>
                <Divider />
                <EnlaceMui component={Link} to={`/cms/contabilidad?recibo=${r.id}`} sx={{ fontSize: 14 }}>Ver sus apuntes en Contabilidad</EnlaceMui>
              </>
            )}
          </Stack>
        </>
      )}
    </Drawer>
  )
}
