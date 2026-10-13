import { useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Tab, Tabs, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { anularPedido, entregarPedido, pedidosDelCms, productos, type EstadoPedido } from '../../lib/api/tienda'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import VentaEnMano from './tienda/VentaEnMano'
import MesaDeProductos from './tienda/MesaDeProductos'
import CategoriasDeLaTienda from './tienda/CategoriasDeLaTienda'
import { nombreConTalla } from '../tienda/cesta'
import { euros, fechaCorta } from './contabilidad/formato'
import { site } from '../../config/site'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

const ESTADOS: Record<EstadoPedido, string> = { PENDIENTE_PAGO: 'Sin pagar', PAGADO: 'Por entregar', ENTREGADO: 'Entregado', CANCELADO: 'Anulado' }

// «INCIDENCIA» no es un estado del pedido (sigue PENDIENTE_PAGO): son los que
// el banco cobró y no se pudieron completar. Se sacan de la lista sin filtro,
// que es la que los trae, para que no se pierdan entre los demás.
type FiltroPedidos = EstadoPedido | '' | 'INCIDENCIA'

type PedidoDeLista = Awaited<ReturnType<typeof pedidosDelCms>>[number]

/** Qué pasa al anular, según hubo cobro aplicado o el pago se quedó en incidencia. */
function explicarAnulacion(p: PedidoDeLista): string {
  if (p.estado === 'PENDIENTE_PAGO') {
    return `El banco cobró ${euros(p.total)}, pero el pedido no llegó a completarse: no hay existencias que devolver ni nada que apuntar en Contabilidad. El dinero se devuelve desde el banco; lo más cómodo es anularlo al resolver su incidencia en Tesorería, que lo cierra todo de una vez. No se puede deshacer.`
  }
  return `Pasa a anulado y vuelven las existencias de lo que llevaba. En Contabilidad se apunta un gasto de ${euros(p.total)} como reembolso; devolverle el dinero a ${p.nombre} es aparte, desde el banco o en Secretaría. No se puede deshacer.`
}

/**
 * La tienda en el CMS: los productos en mesa (la lista y la ficha del
 * elegido, con sus fotos, su precio y sus tallas), los pedidos pagados, que
 * se marcan como entregados al recogerlos en Secretaría, las categorías por
 * las que se filtra en la web, y la venta en mano
 * (lo que se lleva alguien en Secretaría y el efectivo que va al banco).
 */
export default function TiendaAdminPage() {
  const cliente = useQueryClient()
  const [params, setParams] = useSearchParams()
  const vistaPedida = params.get('vista')
  // «caja» era el nombre de antes de la venta en mano: los enlaces viejos siguen valiendo.
  const vista = vistaPedida === 'pedidos' || vistaPedida === 'categorias' ? vistaPedida : vistaPedida === 'mano' || vistaPedida === 'caja' ? 'mano' : 'productos'
  const [estado, setEstado] = useState<FiltroPedidos>('PAGADO')
  const [anulando, setAnulando] = useState<PedidoDeLista | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pedirNuevo, setPedirNuevo] = useState(false)

  const consultaProductos = useQuery({ queryKey: ['tienda', 'productos'], queryFn: productos })
  const consultaPedidos = useQuery({ queryKey: ['tienda', 'pedidos', estado], queryFn: () => pedidosDelCms(estado === 'INCIDENCIA' ? undefined : estado || undefined), enabled: vista === 'pedidos' })
  // Los que esperan en Secretaría, para el aviso de la pestaña: se ven desde cualquier vista.
  const porEntregar = useQuery({ queryKey: ['tienda', 'pedidos', 'PAGADO'], queryFn: () => pedidosDelCms('PAGADO') }).data?.length ?? 0

  const entregar = async (id: number) => {
    setError(null)
    try {
      setAviso((await entregarPedido(id)).message)
      await cliente.invalidateQueries({ queryKey: ['tienda', 'pedidos'] })
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido marcar como entregado.')) }
  }

  const anular = async (id: number) => {
    setAnulando(null); setError(null); setAviso(null)
    try {
      setAviso((await anularPedido(id)).message)
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido anular el pedido.')) }
    // También tras un 409 («acaba de cambiar»): lo que hay en pantalla ya no vale.
    await cliente.invalidateQueries({ queryKey: ['tienda', 'pedidos'] })
  }

  const irA = (v: string) => setParams(v === 'pedidos' || v === 'mano' || v === 'categorias' ? { vista: v } : {})
  const lista = consultaProductos.data
  const pedidos = estado === 'INCIDENCIA' ? consultaPedidos.data?.filter((p) => p.pagoConIncidencia) : consultaPedidos.data

  return <>
    <Helmet><title>{`Tienda | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Tienda" subtitulo="Lo que se vende en la web y en Secretaría, los pedidos por recoger y el efectivo que va al banco.">
      <Button variant="outlined" component={Link} to="/tienda" target="_blank" startIcon={<OpenInNewIcon />}>Ver la tienda</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => { irA('productos'); setPedirNuevo(true) }}>Nuevo producto</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

    <Tabs value={vista} onChange={(_, v: string) => irA(v)} sx={{ mb: 2.5 }}>
      <Tab value="productos" label="Productos" />
      <Tab value="pedidos" label={porEntregar > 0 ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>Pedidos <Chip size="small" color="warning" label={porEntregar} aria-label={`${porEntregar} por entregar`} /></Box> : 'Pedidos'} />
      <Tab value="categorias" label="Categorías" />
      <Tab value="mano" label="Venta en mano" />
    </Tabs>

    {vista === 'productos' && (!lista
      ? (consultaProductos.isError ? <Alert severity="error">{mensaje(consultaProductos.error, 'No se han podido cargar los productos.')}</Alert> : <CircularProgress aria-label="Cargando los productos" />)
      : <MesaDeProductos lista={lista} pedirNuevo={pedirNuevo} onNuevoAtendido={() => setPedirNuevo(false)}
        onAviso={(t) => { setError(null); setAviso(t) }} onError={(t) => { setAviso(null); setError(t) }} />)}

    {vista === 'categorias' && <CategoriasDeLaTienda onAviso={(t) => { setError(null); setAviso(t) }} onError={(t) => { setAviso(null); setError(t) }} />}

    {vista === 'mano' && <VentaEnMano />}

    {vista === 'pedidos' && <>
      <TextField select size="small" label="Pedidos" value={estado} onChange={(e) => setEstado(e.target.value as FiltroPedidos)} sx={{ mb: 2, minWidth: 220 }}>
        <MenuItem value="PAGADO">Por entregar</MenuItem>
        <MenuItem value="INCIDENCIA">Cobrados sin completar</MenuItem>
        <MenuItem value="ENTREGADO">Entregados</MenuItem>
        <MenuItem value="CANCELADO">Anulados</MenuItem>
        <MenuItem value="">Todos</MenuItem>
      </TextField>
      {!pedidos ? (consultaPedidos.isError ? <Alert severity="error">{mensaje(consultaPedidos.error, 'No se han podido cargar los pedidos.')}</Alert> : <CircularProgress aria-label="Cargando los pedidos" />) : pedidos.length === 0
        ? <Alert severity="info">No hay pedidos {estado === 'PAGADO' ? 'por entregar' : estado === 'INCIDENCIA' ? 'cobrados sin completar' : 'aquí'}.</Alert>
        : (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {pedidos.map((p) => (
              <Paper key={p.id} sx={{ p: 2.5, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>N.º {p.id} · {p.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">{p.email} · {p.telefono} · {p.canceladoEl ? `anulado el ${fechaCorta(p.canceladoEl)}` : p.pagadoEl ? `pagado el ${fechaCorta(p.pagadoEl)}` : `pedido el ${fechaCorta(p.creadoEl)}`}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{p.lineas.map((l) => `${l.cantidad} × ${nombreConTalla(l.nombre, l.talla)}`).join(' · ')}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600 }}>{euros(p.total)}</Typography>
                {p.pagoConIncidencia
                  ? <Chip size="small" color="error" label="Cobrado sin completar" />
                  : <Chip size="small" label={ESTADOS[p.estado]} color={p.estado === 'PAGADO' ? 'warning' : p.estado === 'ENTREGADO' ? 'success' : 'default'} />}
                {p.estado === 'PAGADO' && <Button size="small" variant="outlined" onClick={() => void entregar(p.id)}>Entregado</Button>}
                {/* Un PENDIENTE_PAGO sin incidencia es un intento sin pagar: el banco lo cancela solo. */}
                {(p.estado === 'PAGADO' || p.estado === 'ENTREGADO' || p.pagoConIncidencia) && (
                  <Button size="small" color="error" aria-label={`Anular el pedido n.º ${p.id}`} onClick={() => setAnulando(p)}>Anular pedido</Button>
                )}
              </Paper>
            ))}
          </Box>
        )}
      <DialogoConfirmacion
        abierto={anulando !== null}
        titulo={anulando ? `¿Anular el pedido n.º ${anulando.id}?` : ''}
        mensaje={anulando ? explicarAnulacion(anulando) : ''}
        textoConfirmar="Anular pedido"
        textoCancelar="Volver"
        peligro
        onConfirmar={() => { if (anulando) void anular(anulando.id) }}
        onCancelar={() => setAnulando(null)}
      />
    </>}
  </>
}
