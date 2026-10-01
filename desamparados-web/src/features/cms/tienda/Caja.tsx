import { useMemo, useState } from 'react'
import {
  Alert, Box, Button, ButtonBase, Chip, CircularProgress, Divider, IconButton, List, ListItem, ListItemText, Paper, Stack, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { abrirCaja, anularVenta, cerrarCaja, estadoDeCaja, venderEnCaja, type EstadoDeCaja, type MetodoDeCaja, type SesionDeCaja, type VentaDeCaja } from '../../../lib/api/caja'
import { productos as traerProductos, type Producto } from '../../../lib/api/tienda'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import VentanaFormulario from '../VentanaFormulario'
import { euros } from '../contabilidad/formato'
import { deLaCorporacion } from '../../../domain/articulos'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const diaYHora = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const METODO: Record<MetodoDeCaja, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', BIZUM: 'Bizum' }

/** «12,5» o «12.50» → 12.5; vacío → 0; lo que no es un importe, null. */
function leerEuros(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return 0
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null
}

/** Una línea del tique: del catálogo (con su id) o suelta (con su nombre y precio). */
interface LineaTique { clave: string; productoId: number | null; nombre: string; precio: number; cantidad: number }

/**
 * La caja de la tienda, para vender en persona en Secretaría: se abre con el
 * cambio, se van pulsando productos (o se apunta algo suelto), se cobra en
 * efectivo, con tarjeta o con Bizum, y al final del día se cierra contando lo
 * que hay en el cajón. Cada venta entra sola en la contabilidad.
 */
export default function Caja() {
  const cliente = useQueryClient()
  const { data: estado, error: errorCarga } = useQuery({ queryKey: ['caja'], queryFn: estadoDeCaja })
  const { data: catalogo } = useQuery({ queryKey: ['tienda', 'productos'], queryFn: traerProductos })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [fondo, setFondo] = useState('')
  const [tique, setTique] = useState<LineaTique[]>([])
  const [suelto, setSuelto] = useState<{ nombre: string; precio: string } | null>(null)
  const [entregado, setEntregado] = useState('')
  const [aAnular, setAAnular] = useState<VentaDeCaja | null>(null)
  const [cierre, setCierre] = useState<{ contado: string; observaciones: string } | null>(null)

  const poner = (e: EstadoDeCaja) => cliente.setQueryData(['caja'], e)
  const recargarProductos = () => cliente.invalidateQueries({ queryKey: ['tienda', 'productos'] })

  const total = useMemo(() => Math.round(tique.reduce((s, l) => s + l.precio * l.cantidad, 0) * 100) / 100, [tique])
  const entrega = leerEuros(entregado)
  const cambio = entrega !== null && entrega > 0 ? Math.round((entrega - total) * 100) / 100 : null

  const anadir = (p: Producto) => setTique((t) => {
    const ya = t.find((l) => l.productoId === p.id)
    if (ya) return t.map((l) => (l === ya ? { ...l, cantidad: Math.min(20, l.cantidad + 1) } : l))
    return [...t, { clave: `p${p.id}`, productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }]
  })
  const cambiarCantidad = (clave: string, d: number) => setTique((t) => t.flatMap((l) => {
    if (l.clave !== clave) return [l]
    const n = l.cantidad + d
    return n <= 0 ? [] : [{ ...l, cantidad: Math.min(20, n) }]
  }))

  const ejecutar = async (accion: () => Promise<void>, porDefecto: string) => {
    setOcupado(true); setError(null); setAviso(null)
    try { await accion() } catch (err: unknown) { setError(mensaje(err, porDefecto)) } finally { setOcupado(false) }
  }

  const abrir = () => ejecutar(async () => {
    const f = leerEuros(fondo)
    if (f === null) throw new Error('El fondo tiene que ser un importe, con dos decimales como mucho.')
    poner(await abrirCaja(f))
    setFondo('')
  }, 'No se ha podido abrir la caja.')

  const cobrar = (metodo: MetodoDeCaja) => ejecutar(async () => {
    const r = await venderEnCaja(tique.map((l) => (l.productoId !== null
      ? { productoId: l.productoId, cantidad: l.cantidad }
      : { nombre: l.nombre, centimos: Math.round(l.precio * 100), cantidad: l.cantidad })), metodo)
    poner(r.estado)
    setAviso(`Venta n.º ${r.ventaId} cobrada: ${euros(r.total)} (${METODO[metodo].toLowerCase()})${metodo === 'EFECTIVO' && cambio !== null && cambio >= 0 ? `. Cambio: ${euros(cambio)}` : ''}.`)
    setTique([]); setEntregado('')
    await recargarProductos()
  }, 'No se ha podido cobrar la venta.')

  const anular = () => ejecutar(async () => {
    if (!aAnular) return
    poner(await anularVenta(aAnular.id))
    setAviso(`Venta n.º ${aAnular.id} anulada: se ha quitado de la contabilidad.`)
    setAAnular(null)
    await recargarProductos()
  }, 'No se ha podido anular la venta.')

  const cerrar = () => ejecutar(async () => {
    if (!cierre) return
    const contado = leerEuros(cierre.contado)
    if (contado === null) throw new Error('Escribe el efectivo contado, con dos decimales como mucho.')
    const r = await cerrarCaja(contado, cierre.observaciones.trim() || null)
    poner(r.estado)
    setCierre(null); setTique([])
    setAviso(r.diferencia === 0 ? 'Caja cerrada: el efectivo cuadra.' : `Caja cerrada con un descuadre de ${euros(r.diferencia)} (${r.diferencia > 0 ? 'sobra' : 'falta'}).`)
  }, 'No se ha podido cerrar la caja.')

  if (!estado) return errorCarga ? <Alert severity="error">{mensaje(errorCarga, 'No se ha podido cargar la caja.')}</Alert> : <CircularProgress aria-label="Cargando la caja" />

  const abierta = estado.abierta
  const contadoCierre = cierre ? leerEuros(cierre.contado) : null

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert severity="success" onClose={() => setAviso(null)}>{aviso}</Alert>}

      {!abierta ? (
        <Paper sx={{ p: 2.5, maxWidth: 520 }}>
          <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>La caja está cerrada</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Ábrela con el cambio que hay en el cajón para empezar a vender.</Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <TextField label="Fondo inicial (€)" size="small" value={fondo} onChange={(e) => setFondo(e.target.value)} error={leerEuros(fondo) === null} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            <Button variant="contained" onClick={() => void abrir()} disabled={ocupado || leerEuros(fondo) === null}>Abrir la caja</Button>
          </Stack>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 2fr)' }, alignItems: 'start' }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Abierta {diaYHora(abierta.abiertaEl)}{abierta.abiertaPor ? ` por ${abierta.abiertaPor}` : ''} con {euros(abierta.fondoInicial)} de fondo.
            </Typography>
            <Box role="group" aria-label="Productos" sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {(catalogo ?? []).map((p) => {
                const agotado = p.existencias !== null && p.existencias <= (tique.find((l) => l.productoId === p.id)?.cantidad ?? 0)
                return (
                  <ButtonBase key={p.id} onClick={() => anadir(p)} disabled={agotado}
                    sx={{ p: 1.5, borderRadius: 1, border: 1, borderColor: 'divider', display: 'block', textAlign: 'left', opacity: agotado ? 0.45 : 1, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{p.nombre}</Typography>
                    <Typography variant="body2">{euros(p.precio)}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.existencias === null ? 'Sin límite' : `Quedan ${p.existencias}`}{p.activo ? '' : ' · fuera de la web'}</Typography>
                  </ButtonBase>
                )
              })}
              <ButtonBase onClick={() => setSuelto({ nombre: '', precio: '' })} sx={{ p: 1.5, borderRadius: 1, border: 1, borderStyle: 'dashed', borderColor: 'divider', display: 'block', textAlign: 'left' }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Otra cosa</Typography>
                <Typography variant="body2" color="text.secondary">Con su precio</Typography>
              </ButtonBase>
            </Box>
            {catalogo?.length === 0 && <Typography color="text.secondary">No hay productos: añádelos en la pestaña «Productos», o vende con «Otra cosa».</Typography>}
          </Stack>

          <Paper sx={{ p: 2 }}>
            <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>Venta</Typography>
            {tique.length === 0 ? <Typography color="text.secondary" sx={{ py: 1 }}>Pulsa los productos para añadirlos.</Typography> : (
              <List dense disablePadding>
                {tique.map((l) => (
                  <ListItem key={l.clave} disableGutters secondaryAction={<Typography sx={{ fontWeight: 600 }}>{euros(l.precio * l.cantidad)}</Typography>} sx={{ pr: 10 }}>
                    <IconButton size="small" aria-label={`Uno menos de ${l.nombre}`} onClick={() => cambiarCantidad(l.clave, -1)}><RemoveIcon fontSize="small" /></IconButton>
                    <Typography sx={{ minWidth: 22, textAlign: 'center' }}>{l.cantidad}</Typography>
                    <IconButton size="small" aria-label={`Uno más de ${l.nombre}`} onClick={() => cambiarCantidad(l.clave, 1)}><AddIcon fontSize="small" /></IconButton>
                    <ListItemText primary={l.nombre} secondary={euros(l.precio)} sx={{ ml: 1 }} />
                  </ListItem>
                ))}
              </List>
            )}
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Total</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 20 }} aria-label="Total de la venta">{euros(total)}</Typography>
            </Stack>
            <TextField label="Entrega en efectivo (€)" size="small" fullWidth value={entregado} onChange={(e) => setEntregado(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              helperText={cambio !== null ? (cambio >= 0 ? `Cambio: ${euros(cambio)}` : `Faltan ${euros(-cambio)}`) : 'Para calcular el cambio'} error={cambio !== null && cambio < 0} />
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              {(['EFECTIVO', 'TARJETA', 'BIZUM'] as const).map((m, i) => (
                <Button key={m} variant={i === 0 ? 'contained' : 'outlined'} fullWidth disabled={ocupado || tique.length === 0 || (m === 'EFECTIVO' && cambio !== null && cambio < 0)} onClick={() => void cobrar(m)}>
                  {METODO[m]}
                </Button>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{`La tarjeta y el Bizum se cobran en el datáfono o en el móvil ${deLaCorporacion({ corto: true })}; aquí solo se apunta cómo se pagó.`}</Typography>
          </Paper>
        </Box>
      )}

      {abierta && <SesionAbierta sesion={abierta} ocupado={ocupado} onAnular={setAAnular} onCerrar={() => setCierre({ contado: '', observaciones: '' })} />}

      {estado.cerradas.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>Cajas cerradas</Typography>
          <List dense disablePadding>
            {estado.cerradas.map((s) => {
              const diferencia = s.efectivoContado === null ? 0 : Math.round((s.efectivoContado - s.efectivoEsperado) * 100) / 100
              return (
                <ListItem key={s.id} divider disableGutters>
                  <ListItemText
                    primary={`${diaYHora(s.abiertaEl)} → ${s.cerradaEl ? diaYHora(s.cerradaEl) : ''} · ${s.resumen.ventas} ventas · ${euros(s.resumen.total)}`}
                    secondary={`Efectivo ${euros(s.resumen.porMetodo.EFECTIVO)} · tarjeta ${euros(s.resumen.porMetodo.TARJETA)} · Bizum ${euros(s.resumen.porMetodo.BIZUM)}${s.cerradaPor ? ` · cerró ${s.cerradaPor}` : ''}${s.observaciones ? ` · ${s.observaciones}` : ''}`}
                  />
                  <Chip size="small" color={diferencia === 0 ? 'success' : 'warning'} label={diferencia === 0 ? 'Cuadra' : `${diferencia > 0 ? 'Sobran' : 'Faltan'} ${euros(Math.abs(diferencia))}`} />
                </ListItem>
              )
            })}
          </List>
        </Paper>
      )}

      <VentanaFormulario
        abierto={suelto !== null}
        titulo="Vender otra cosa"
        textoGuardar="Añadir a la venta"
        sucio={Boolean(suelto?.nombre || suelto?.precio)}
        puedeGuardar={Boolean(suelto?.nombre.trim()) && (leerEuros(suelto?.precio ?? '') ?? 0) > 0}
        onGuardar={() => {
          if (!suelto) return
          setTique((t) => [...t, { clave: `s${Date.now()}`, productoId: null, nombre: suelto.nombre.trim(), precio: leerEuros(suelto.precio) ?? 0, cantidad: 1 }])
          setSuelto(null)
        }}
        onCerrar={() => setSuelto(null)}
      >
        {suelto && <>
          <TextField label="Qué es" value={suelto.nombre} onChange={(e) => setSuelto({ ...suelto, nombre: e.target.value })} fullWidth slotProps={{ htmlInput: { maxLength: 120 } }} />
          <TextField label="Precio (€)" value={suelto.precio} onChange={(e) => setSuelto({ ...suelto, precio: e.target.value })} fullWidth slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </>}
      </VentanaFormulario>

      <DialogoConfirmacion
        abierto={aAnular !== null}
        titulo="Anular la venta"
        mensaje={aAnular ? `La venta n.º ${aAnular.id} (${euros(aAnular.total)}) se quita de la contabilidad y lo vendido vuelve a las existencias. Si se cobró con tarjeta o Bizum, devuélvelo también por allí.` : ''}
        textoConfirmar="Anular"
        peligro
        onConfirmar={() => void anular()}
        onCancelar={() => setAAnular(null)}
      />

      <VentanaFormulario
        abierto={cierre !== null}
        titulo="Cerrar la caja"
        textoGuardar="Cerrar la caja"
        sucio={Boolean(cierre?.contado)}
        guardando={ocupado}
        puedeGuardar={cierre !== null && cierre.contado.trim() !== '' && contadoCierre !== null}
        onGuardar={cerrar}
        onCerrar={() => setCierre(null)}
      >
        {cierre && abierta && <>
          <Typography>Debería haber <strong>{euros(abierta.efectivoEsperado)}</strong> en efectivo: {euros(abierta.fondoInicial)} de fondo y {euros(abierta.resumen.porMetodo.EFECTIVO)} cobrados en efectivo.</Typography>
          <TextField label="Efectivo contado (€)" value={cierre.contado} onChange={(e) => setCierre({ ...cierre, contado: e.target.value })} fullWidth autoFocus slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            helperText={contadoCierre !== null && cierre.contado.trim() !== '' ? (() => { const d = Math.round((contadoCierre - abierta.efectivoEsperado) * 100) / 100; return d === 0 ? 'Cuadra.' : `${d > 0 ? 'Sobran' : 'Faltan'} ${euros(Math.abs(d))}.` })() : ' '} />
          <TextField label="Observaciones (opcional)" value={cierre.observaciones} onChange={(e) => setCierre({ ...cierre, observaciones: e.target.value })} fullWidth multiline slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </>}
      </VentanaFormulario>
    </Stack>
  )
}

/** Lo vendido en la caja abierta, con «Anular», y el botón de cerrarla. */
function SesionAbierta({ sesion, ocupado, onAnular, onCerrar }: { sesion: SesionDeCaja; ocupado: boolean; onAnular: (v: VentaDeCaja) => void; onCerrar: () => void }) {
  const r = sesion.resumen
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1 }}>
        <Typography component="h2" sx={{ fontWeight: 600 }}>
          Hoy: {r.ventas} {r.ventas === 1 ? 'venta' : 'ventas'} · {euros(r.total)}
        </Typography>
        <Button variant="contained" color="secondary" onClick={onCerrar} disabled={ocupado}>Cerrar la caja</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Efectivo {euros(r.porMetodo.EFECTIVO)} · tarjeta {euros(r.porMetodo.TARJETA)} · Bizum {euros(r.porMetodo.BIZUM)} · en el cajón debería haber {euros(sesion.efectivoEsperado)}
      </Typography>
      {sesion.ventas.length > 0 && (
        <List dense disablePadding>
          {sesion.ventas.map((v) => (
            <ListItem key={v.id} divider disableGutters
              secondaryAction={v.anuladaEl ? <Chip size="small" label="Anulada" /> : <Button size="small" onClick={() => onAnular(v)} disabled={ocupado}>Anular</Button>}
              sx={{ pr: 12, opacity: v.anuladaEl ? 0.55 : 1 }}>
              <ListItemText
                primary={`${hora(v.vendidaEl)} · n.º ${v.id} · ${euros(v.total)} · ${METODO[v.metodo]}`}
                secondary={v.lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join(', ')}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  )
}
