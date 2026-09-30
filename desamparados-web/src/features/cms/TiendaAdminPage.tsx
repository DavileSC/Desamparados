import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, FormControlLabel, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import {
  borrarProducto, crearProducto, entregarPedido, guardarProducto, pedidosDelCms, productos,
  type DatosProducto, type EstadoPedido, type PedidoDelCms, type Producto,
} from '../../lib/api/tienda'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import CampoImagen from './CampoImagen'
import { euros, fechaCorta } from './contabilidad/formato'
import { site } from '../../config/site'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const PRECIO = /^\d{1,5}(?:[.,]\d{1,2})?$/

interface Formulario { nombre: string; descripcion: string; precio: string; foto: string; existencias: string; activo: boolean; orden: string }
const VACIO: Formulario = { nombre: '', descripcion: '', precio: '', foto: '', existencias: '', activo: true, orden: '0' }
const aFormulario = (p: Producto): Formulario => ({
  nombre: p.nombre, descripcion: p.descripcion, precio: p.precio.toFixed(2).replace('.', ','), foto: p.foto ?? '',
  existencias: p.existencias === null ? '' : String(p.existencias), activo: p.activo, orden: String(p.orden),
})
const aDatos = (f: Formulario): DatosProducto => ({
  nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), precio: Number(f.precio.replace(',', '.')), foto: f.foto || null,
  existencias: f.existencias.trim() === '' ? null : Number(f.existencias), activo: f.activo, orden: Number(f.orden) || 0,
})

const ESTADOS: Record<EstadoPedido, string> = { PENDIENTE_PAGO: 'Sin pagar', PAGADO: 'Por entregar', ENTREGADO: 'Entregado', CANCELADO: 'Anulado' }

/**
 * La tienda en el CMS: los productos (con su foto, su precio y cuántos
 * quedan) y los pedidos pagados, que se marcan como entregados al recogerlos
 * en Secretaría.
 */
export default function TiendaAdminPage() {
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'pedidos' ? 'pedidos' : 'productos'
  const [lista, setLista] = useState<Producto[] | null>(null)
  const [pedidos, setPedidos] = useState<PedidoDelCms[] | null>(null)
  const [estado, setEstado] = useState<EstadoPedido | ''>('PAGADO')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: number | null; form: Formulario; original: Formulario } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<Producto | null>(null)

  const cargarProductos = useCallback(() => productos().then(setLista), [])
  const cargarPedidos = useCallback(() => pedidosDelCms(estado || undefined).then(setPedidos), [estado])
  useEffect(() => { cargarProductos().catch((err: unknown) => setError(mensaje(err, 'No se han podido cargar los productos.'))) }, [cargarProductos])
  useEffect(() => { if (vista === 'pedidos') cargarPedidos().catch((err: unknown) => setError(mensaje(err, 'No se han podido cargar los pedidos.'))) }, [vista, cargarPedidos])

  const guardar = async () => {
    if (!editando) return
    setGuardando(true); setErrorForm(null)
    try {
      const datos = aDatos(editando.form)
      await (editando.id === null ? crearProducto(datos) : guardarProducto(editando.id, datos))
      setEditando(null); setAviso('Producto guardado.'); await cargarProductos()
    } catch (err: unknown) { setErrorForm(mensaje(err, 'No se ha podido guardar.')) }
    finally { setGuardando(false) }
  }

  const borrar = async () => {
    if (!aBorrar) return
    const p = aBorrar
    setABorrar(null)
    try { setAviso((await borrarProducto(p.id)).message); await cargarProductos() }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido borrar.')) }
  }

  const entregar = async (id: number) => {
    setError(null)
    try { setAviso((await entregarPedido(id)).message); await cargarPedidos() }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido marcar como entregado.')) }
  }

  const f = editando?.form
  const valido = Boolean(f && f.nombre.trim() && PRECIO.test(f.precio.trim()) && Number(f.precio.replace(',', '.')) > 0 && (f.existencias.trim() === '' || /^\d+$/.test(f.existencias.trim())))

  return <>
    <Helmet><title>{`Tienda | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Tienda" subtitulo="Lo que se vende en la web y los pedidos por recoger en Secretaría.">
      <Button variant="outlined" component={Link} to="/tienda" target="_blank" startIcon={<OpenInNewIcon />}>Ver la tienda</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setErrorForm(null); setEditando({ id: null, form: VACIO, original: VACIO }) }}>Nuevo producto</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

    <Tabs value={vista} onChange={(_, v: string) => setParams(v === 'pedidos' ? { vista: 'pedidos' } : {})} sx={{ mb: 2 }}>
      <Tab value="productos" label="Productos" />
      <Tab value="pedidos" label="Pedidos" />
    </Tabs>

    {vista === 'productos' && (!lista ? <CircularProgress aria-label="Cargando los productos" /> : lista.length === 0
      ? <Alert severity="info">Todavía no hay productos. Crea el primero con «Nuevo producto».</Alert>
      : (
        <Paper component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {lista.map((p, i) => (
            <Box component="li" key={p.id} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', px: 2.5, py: 1.5, borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider', opacity: p.activo ? 1 : 0.6 }}>
              {p.foto ? <Box component="img" src={p.foto} alt="" sx={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 0.5 }} /> : <Box sx={{ width: 56, height: 42, bgcolor: 'action.hover', borderRadius: 0.5 }} />}
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{p.nombre}</Typography>
                <Typography variant="body2" color="text.secondary">{euros(p.precio)} · {p.existencias === null ? 'sin límite' : p.existencias === 0 ? 'agotado' : `quedan ${p.existencias}`}{p.activo ? '' : ' · retirado'}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => { setErrorForm(null); setEditando({ id: p.id, form: aFormulario(p), original: aFormulario(p) }) }}>Editar</Button>
                <Button size="small" color="error" onClick={() => setABorrar(p)}>Borrar</Button>
              </Stack>
            </Box>
          ))}
        </Paper>
      ))}

    {vista === 'pedidos' && <>
      <TextField select size="small" label="Pedidos" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPedido | '')} sx={{ mb: 2, minWidth: 220 }}>
        <MenuItem value="PAGADO">Por entregar</MenuItem>
        <MenuItem value="ENTREGADO">Entregados</MenuItem>
        <MenuItem value="">Todos los pagados</MenuItem>
      </TextField>
      {!pedidos ? <CircularProgress aria-label="Cargando los pedidos" /> : pedidos.length === 0
        ? <Alert severity="info">No hay pedidos {estado === 'PAGADO' ? 'por entregar' : 'aquí'}.</Alert>
        : (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {pedidos.map((p) => (
              <Paper key={p.id} sx={{ p: 2.5, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>N.º {p.id} · {p.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">{p.email} · {p.telefono} · {p.pagadoEl ? `pagado el ${fechaCorta(p.pagadoEl)}` : `pedido el ${fechaCorta(p.creadoEl)}`}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{p.lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join(' · ')}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600 }}>{euros(p.total)}</Typography>
                <Chip size="small" label={ESTADOS[p.estado]} color={p.estado === 'PAGADO' ? 'warning' : p.estado === 'ENTREGADO' ? 'success' : 'default'} />
                {p.estado === 'PAGADO' && <Button size="small" variant="outlined" onClick={() => void entregar(p.id)}>Entregado</Button>}
              </Paper>
            ))}
          </Box>
        )}
    </>}

    <VentanaFormulario
      abierto={editando !== null}
      titulo={editando?.id === null ? 'Nuevo producto' : 'Editar producto'}
      sucio={Boolean(editando && JSON.stringify(editando.form) !== JSON.stringify(editando.original))}
      guardando={guardando}
      puedeGuardar={valido}
      error={errorForm}
      onGuardar={guardar}
      onCerrar={() => setEditando(null)}
    >
      {f && editando && <>
        <TextField label="Nombre" value={f.nombre} onChange={(e) => setEditando({ ...editando, form: { ...f, nombre: e.target.value } })} slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth />
        <TextField label="Descripción" value={f.descripcion} onChange={(e) => setEditando({ ...editando, form: { ...f, descripcion: e.target.value } })} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} fullWidth />
        <Stack direction="row" spacing={2}>
          <TextField label="Precio (€)" value={f.precio} onChange={(e) => setEditando({ ...editando, form: { ...f, precio: e.target.value } })} slotProps={{ htmlInput: { inputMode: 'decimal' } }} error={Boolean(f.precio) && !PRECIO.test(f.precio.trim())} fullWidth />
          <TextField label="Quedan" value={f.existencias} onChange={(e) => setEditando({ ...editando, form: { ...f, existencias: e.target.value } })} helperText="Vacío: sin límite" slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
          <TextField label="Orden" type="number" value={f.orden} onChange={(e) => setEditando({ ...editando, form: { ...f, orden: e.target.value } })} sx={{ width: 110, flexShrink: 0 }} />
        </Stack>
        <CampoImagen valor={f.foto} onCambio={(ruta) => setEditando({ ...editando, form: { ...f, foto: ruta } })} etiqueta="Foto" />
        <FormControlLabel control={<Switch checked={f.activo} onChange={(e) => setEditando({ ...editando, form: { ...f, activo: e.target.checked } })} />} label="A la venta" />
      </>}
    </VentanaFormulario>

    <DialogoConfirmacion
      abierto={aBorrar !== null}
      titulo="¿Borrar el producto?"
      mensaje={aBorrar ? `«${aBorrar.nombre}» deja de estar en la tienda. Si ya tiene pedidos, se retira de la venta en vez de borrarse.` : ''}
      textoConfirmar="Borrar"
      peligro
      onConfirmar={() => void borrar()}
      onCancelar={() => setABorrar(null)}
    />
  </>
}
