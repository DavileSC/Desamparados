import { useMemo, useState } from 'react'
import {
  Alert, Box, Button, ButtonBase, Chip, CircularProgress, Divider, IconButton, List, ListItem, ListItemText, Menu, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  anularVenta, borrarIngreso, estadoVentaEnMano, ingresarEnBanco, venderEnMano,
  type EstadoVentaEnMano, type IngresoEnBanco, type MetodoDeCaja, type VentaEnMano as Venta,
} from '../../../lib/api/caja'
import { productos as traerProductos, type Producto, type TallaDeProducto } from '../../../lib/api/tienda'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import VentanaFormulario from '../VentanaFormulario'
import { euros, fechaCorta } from '../contabilidad/formato'
import { nombreConTalla } from '../../tienda/cesta'
import { existenciasEnTexto } from './formularioProducto'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const diaYHora = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
/** Hoy en Madrid, AAAA-MM-DD: el día que se propone para el ingreso. */
const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const METODO: Record<MetodoDeCaja, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', BIZUM: 'Bizum' }

/** «12,5» o «12.50» → 12.5; vacío → 0; lo que no es un importe, null. */
function leerEuros(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return 0
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null
}

/** Una línea de la venta: del catálogo (con su id y, si la tiene, su talla) o suelta (con su nombre y precio). */
interface Linea { clave: string; productoId: number | null; tallaId: number | null; nombre: string; precio: number; cantidad: number }

/**
 * La venta en mano: cuando alguien se lleva algo en Secretaría sin pasar por
 * la web. Se pulsa lo que se lleva, se dice cómo pagó y queda apuntado: baja
 * lo que queda y el ingreso entra en Contabilidad.
 *
 * No hay caja que abrir ni que cerrar: el Grupo guarda el efectivo y lo lleva
 * al banco más tarde. Al llevarlo se apunta aquí («Ingresado en el banco»), y
 * así se sabe cuánto efectivo queda por ingresar y la partida doble lo pasa
 * de Caja a Bancos.
 */
export default function VentaEnMano() {
  const cliente = useQueryClient()
  const { data: estado, error: errorCarga } = useQuery({ queryKey: ['venta-en-mano'], queryFn: estadoVentaEnMano })
  const { data: catalogo } = useQuery({ queryKey: ['tienda', 'productos'], queryFn: traerProductos })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [venta, setVenta] = useState<Linea[]>([])
  const [suelto, setSuelto] = useState<{ nombre: string; precio: string } | null>(null)
  const [aAnular, setAAnular] = useState<Venta | null>(null)
  const [ingreso, setIngreso] = useState<{ fecha: string; importe: string; nota: string } | null>(null)
  const [aBorrar, setABorrar] = useState<IngresoEnBanco | null>(null)
  // El producto con tallas que se acaba de pulsar: se elige la talla en un menú junto a él.
  const [eligiendo, setEligiendo] = useState<{ producto: Producto; ancla: HTMLElement } | null>(null)

  const poner = (e: EstadoVentaEnMano) => cliente.setQueryData(['venta-en-mano'], e)
  const recargarProductos = () => cliente.invalidateQueries({ queryKey: ['tienda'] })

  const total = useMemo(() => Math.round(venta.reduce((s, l) => s + l.precio * l.cantidad, 0) * 100) / 100, [venta])

  const anadir = (p: Producto, talla: TallaDeProducto | null = null) => setVenta((v) => {
    const clave = talla ? `p${p.id}:${talla.id}` : `p${p.id}`
    const ya = v.find((l) => l.clave === clave)
    if (ya) return v.map((l) => (l === ya ? { ...l, cantidad: Math.min(20, l.cantidad + 1) } : l))
    return [...v, { clave, productoId: p.id, tallaId: talla?.id ?? null, nombre: nombreConTalla(p.nombre, talla?.nombre), precio: p.precio, cantidad: 1 }]
  })
  /** Cuántas de un producto (o de una talla suya) hay ya en la venta. */
  const enVenta = (productoId: number, tallaId: number | null) => venta.filter((l) => l.productoId === productoId && l.tallaId === tallaId).reduce((s, l) => s + l.cantidad, 0)
  const tallaAgotada = (p: Producto, t: TallaDeProducto) => t.existencias !== null && t.existencias <= enVenta(p.id, t.id)
  const cambiarCantidad = (clave: string, d: number) => setVenta((v) => v.flatMap((l) => {
    if (l.clave !== clave) return [l]
    const n = l.cantidad + d
    return n <= 0 ? [] : [{ ...l, cantidad: Math.min(20, n) }]
  }))

  const ejecutar = async (accion: () => Promise<void>, porDefecto: string) => {
    setOcupado(true); setError(null); setAviso(null)
    try { await accion() } catch (err: unknown) { setError(mensaje(err, porDefecto)) } finally { setOcupado(false) }
  }

  const apuntar = (metodo: MetodoDeCaja) => ejecutar(async () => {
    const r = await venderEnMano(venta.map((l) => (l.productoId !== null
      ? { productoId: l.productoId, ...(l.tallaId !== null ? { tallaId: l.tallaId } : {}), cantidad: l.cantidad }
      : { nombre: l.nombre, centimos: Math.round(l.precio * 100), cantidad: l.cantidad })), metodo)
    poner(r.estado)
    setAviso(`Venta n.º ${r.ventaId} apuntada: ${euros(r.total)} en ${METODO[metodo].toLowerCase()}.${metodo === 'EFECTIVO' ? ' Queda por ingresar en el banco.' : ''}`)
    setVenta([])
    await recargarProductos()
  }, 'No se ha podido apuntar la venta.')

  const anular = () => ejecutar(async () => {
    if (!aAnular) return
    const id = aAnular.id
    setAAnular(null)
    poner(await anularVenta(id))
    setAviso(`Venta n.º ${id} anulada: se ha quitado de la contabilidad y lo vendido vuelve a lo que queda.`)
    await recargarProductos()
  }, 'No se ha podido anular la venta.')

  const ingresar = () => ejecutar(async () => {
    if (!ingreso) return
    const importe = leerEuros(ingreso.importe)
    if (!importe) throw new Error('Escribe el importe ingresado, con dos decimales como mucho.')
    poner(await ingresarEnBanco(ingreso.fecha, importe, ingreso.nota.trim() || null))
    setIngreso(null)
    setAviso(`Apuntado: ${euros(importe)} ingresados en el banco.`)
  }, 'No se ha podido apuntar el ingreso.')

  const borrar = () => ejecutar(async () => {
    if (!aBorrar) return
    const b = aBorrar
    setABorrar(null)
    poner(await borrarIngreso(b.id))
    setAviso(`Ingreso del ${fechaCorta(b.fecha)} borrado: ese efectivo vuelve a estar por ingresar.`)
  }, 'No se ha podido borrar el ingreso.')

  if (!estado) return errorCarga ? <Alert severity="error">{mensaje(errorCarga, 'No se ha podido cargar la venta en mano.')}</Alert> : <CircularProgress aria-label="Cargando la venta en mano" />

  const pendiente = estado.efectivoPorIngresar
  const importeIngreso = ingreso ? leerEuros(ingreso.importe) : null

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert severity="success" onClose={() => setAviso(null)}>{aviso}</Alert>}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 2fr)' }, alignItems: 'start' }}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">Cuando alguien se lleve algo en Secretaría, púlsalo aquí y di cómo pagó: baja lo que queda y el ingreso entra en Contabilidad.</Typography>
          <Box role="group" aria-label="Productos" sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {(catalogo ?? []).map((p) => {
              const agotado = p.tallas.length > 0
                ? p.tallas.every((t) => tallaAgotada(p, t))
                : p.existencias !== null && p.existencias <= enVenta(p.id, null)
              const texto = existenciasEnTexto(p)
              return (
                <ButtonBase key={p.id} onClick={(e) => (p.tallas.length > 0 ? setEligiendo({ producto: p, ancla: e.currentTarget }) : anadir(p))} disabled={agotado}
                  aria-haspopup={p.tallas.length > 0 ? 'menu' : undefined}
                  sx={{ p: 1.5, borderRadius: 1, border: 1, borderColor: 'divider', display: 'block', textAlign: 'left', opacity: agotado ? 0.45 : 1, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{p.nombre}</Typography>
                  <Typography variant="body2">{euros(p.precio)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.tallas.length > 0 ? `${p.tallas.length} tallas · ` : ''}{texto.charAt(0).toUpperCase() + texto.slice(1)}{p.activo ? '' : ' · fuera de la web'}
                  </Typography>
                </ButtonBase>
              )
            })}
            <ButtonBase onClick={() => setSuelto({ nombre: '', precio: '' })} sx={{ p: 1.5, borderRadius: 1, border: 1, borderStyle: 'dashed', borderColor: 'divider', display: 'block', textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Otra cosa</Typography>
              <Typography variant="body2" color="text.secondary">Con su precio</Typography>
            </ButtonBase>
          </Box>
          {catalogo?.length === 0 && <Typography color="text.secondary">No hay productos: añádelos en la pestaña «Productos», o apunta la venta con «Otra cosa».</Typography>}
          <Menu anchorEl={eligiendo?.ancla} open={eligiendo !== null} onClose={() => setEligiendo(null)}
            slotProps={{ list: { 'aria-label': eligiendo ? `Talla de ${eligiendo.producto.nombre}` : undefined } }}>
            {eligiendo?.producto.tallas.map((t) => (
              <MenuItem key={t.id} disabled={tallaAgotada(eligiendo.producto, t)} onClick={() => { anadir(eligiendo.producto, t); setEligiendo(null) }}
                sx={{ minWidth: 180, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                <span>Talla {t.nombre}</span>
                <Typography component="span" variant="body2" color="text.secondary">{t.existencias === null ? 'sin límite' : t.existencias === 0 ? 'agotada' : `quedan ${t.existencias}`}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </Stack>

        <Paper sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>Lo que se lleva</Typography>
          {venta.length === 0 ? <Typography color="text.secondary" sx={{ py: 1 }}>Pulsa los productos para añadirlos.</Typography> : (
            <List dense disablePadding>
              {venta.map((l) => (
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
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>¿Cómo ha pagado?</Typography>
          <Stack direction="row" spacing={1}>
            {(['EFECTIVO', 'BIZUM', 'TARJETA'] as const).map((m, i) => (
              <Button key={m} variant={i === 0 ? 'contained' : 'outlined'} fullWidth disabled={ocupado || venta.length === 0} onClick={() => void apuntar(m)}>
                {METODO[m]}
              </Button>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>El Bizum y la tarjeta ya están en el banco; el efectivo queda por ingresar hasta que lo apuntes abajo.</Typography>
        </Paper>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
          <Box>
            <Typography component="h2" sx={{ fontWeight: 600 }}>Efectivo por ingresar en el banco: {euros(pendiente)}</Typography>
            <Typography variant="body2" color="text.secondary">Lo cobrado en efectivo en mano, menos lo que ya se ha llevado al banco.</Typography>
          </Box>
          <Button variant="contained" disabled={ocupado || pendiente <= 0} onClick={() => setIngreso({ fecha: hoy(), importe: pendiente.toFixed(2).replace('.', ','), nota: '' })}>
            Apuntar ingreso en el banco
          </Button>
        </Stack>
        {estado.ingresos.length > 0 && (
          <List dense disablePadding sx={{ mt: 1.5 }} aria-label="Ingresado en el banco">
            {estado.ingresos.map((i) => (
              <ListItem key={i.id} divider disableGutters secondaryAction={<Button size="small" color="error" onClick={() => setABorrar(i)} disabled={ocupado}>Borrar</Button>} sx={{ pr: 10 }}>
                <ListItemText
                  primary={`${fechaCorta(i.fecha)} · ${euros(i.importe)} ingresados en el banco`}
                  secondary={[i.nota, i.apuntadoPor ? `apuntó ${i.apuntadoPor}` : null].filter(Boolean).join(' · ') || undefined}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {estado.ventas.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>Últimas ventas en mano</Typography>
          <List dense disablePadding>
            {estado.ventas.map((v) => (
              <ListItem key={v.id} divider disableGutters
                secondaryAction={v.anuladaEl ? <Chip size="small" label="Anulada" /> : v.anulable && <Button size="small" onClick={() => setAAnular(v)} disabled={ocupado}>Anular</Button>}
                sx={{ pr: 12, opacity: v.anuladaEl ? 0.55 : 1 }}>
                <ListItemText
                  primary={`${diaYHora(v.vendidaEl)} · n.º ${v.id} · ${euros(v.total)} · ${METODO[v.metodo]}`}
                  secondary={v.lineas.map((l) => `${l.cantidad} × ${nombreConTalla(l.nombre, l.talla)}`).join(', ')}
                />
              </ListItem>
            ))}
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
          setVenta((v) => [...v, { clave: `s${Date.now()}`, productoId: null, tallaId: null, nombre: suelto.nombre.trim(), precio: leerEuros(suelto.precio) ?? 0, cantidad: 1 }])
          setSuelto(null)
        }}
        onCerrar={() => setSuelto(null)}
      >
        {suelto && <>
          <TextField label="Qué es" value={suelto.nombre} onChange={(e) => setSuelto({ ...suelto, nombre: e.target.value })} fullWidth slotProps={{ htmlInput: { maxLength: 120 } }} />
          <TextField label="Precio (€)" value={suelto.precio} onChange={(e) => setSuelto({ ...suelto, precio: e.target.value })} fullWidth slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </>}
      </VentanaFormulario>

      <VentanaFormulario
        abierto={ingreso !== null}
        titulo="Ingreso en el banco"
        textoGuardar="Apuntar el ingreso"
        sucio={false}
        guardando={ocupado}
        puedeGuardar={ingreso !== null && Boolean(ingreso.fecha) && importeIngreso !== null && importeIngreso > 0 && importeIngreso <= pendiente}
        onGuardar={ingresar}
        onCerrar={() => setIngreso(null)}
      >
        {ingreso && <>
          <Typography>Quedan <strong>{euros(pendiente)}</strong> de la tienda por ingresar.</Typography>
          <TextField label="Día del ingreso" type="date" value={ingreso.fecha} onChange={(e) => setIngreso({ ...ingreso, fecha: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy() } }} />
          <TextField label="Importe ingresado (€)" value={ingreso.importe} onChange={(e) => setIngreso({ ...ingreso, importe: e.target.value })} fullWidth slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            error={importeIngreso === null || (importeIngreso !== null && importeIngreso > pendiente)}
            helperText={importeIngreso !== null && importeIngreso > pendiente ? `No puede pasar de ${euros(pendiente)}. Si llevas también dinero de otra cosa, apunta aquí solo lo de la tienda.` : 'Lo de la tienda que has llevado al banco.'} />
          <TextField label="Nota (opcional)" value={ingreso.nota} onChange={(e) => setIngreso({ ...ingreso, nota: e.target.value })} fullWidth slotProps={{ htmlInput: { maxLength: 300 } }} />
        </>}
      </VentanaFormulario>

      <DialogoConfirmacion
        abierto={aAnular !== null}
        titulo="Anular la venta"
        mensaje={aAnular ? `La venta n.º ${aAnular.id} (${euros(aAnular.total)}) se quita de la contabilidad y lo vendido vuelve a lo que queda.${aAnular.metodo === 'EFECTIVO' ? '' : ' Si se cobró con tarjeta o Bizum, devuélvelo también por allí.'}` : ''}
        textoConfirmar="Anular"
        peligro
        onConfirmar={() => void anular()}
        onCancelar={() => setAAnular(null)}
      />
      <DialogoConfirmacion
        abierto={aBorrar !== null}
        titulo="Borrar el ingreso"
        mensaje={aBorrar ? `El ingreso del ${fechaCorta(aBorrar.fecha)} (${euros(aBorrar.importe)}) se borra y ese efectivo vuelve a estar por ingresar.` : ''}
        textoConfirmar="Borrar"
        peligro
        onConfirmar={() => void borrar()}
        onCancelar={() => setABorrar(null)}
      />
    </Stack>
  )
}
