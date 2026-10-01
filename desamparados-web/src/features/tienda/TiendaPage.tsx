import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { useNavigate } from 'react-router-dom'
import MetaDePagina from '../../components/MetaDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import { catalogo, comprar, type Catalogo, type MetodoEnLinea } from '../../lib/api/tienda'
import { irAlBanco } from '../../lib/api/procesion'
import { site } from '../../config/site'
import { deLaCorporacion } from '../../domain/articulos'

const CLAVE_CESTA = 'tienda-cesta'
const euros = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

/** La cesta vive en el navegador: si se recarga la página o se vuelve del banco, sigue ahí. */
function leerCesta(): Record<number, number> {
  try { return JSON.parse(window.localStorage.getItem(CLAVE_CESTA) ?? '{}') as Record<number, number> } catch { return {} }
}
function guardarCesta(cesta: Record<number, number>) {
  try { window.localStorage.setItem(CLAVE_CESTA, JSON.stringify(cesta)) } catch { /* sin almacenamiento, la cesta dura lo que la página */ }
}

/**
 * La tienda del Grupo: los recuerdos a la venta, la cesta y el pago, sin
 * cuenta. Lo pedido se recoge en Secretaría.
 */
export default function TiendaPage() {
  const navegar = useNavigate()
  const [datos, setDatos] = useState<Catalogo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cesta, setCesta] = useState<Record<number, number>>(leerCesta)
  const [comprador, setComprador] = useState({ nombre: '', email: '', telefono: '', metodo: 'TARJETA' as MetodoEnLinea })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    catalogo()
      .then((c) => { if (!cancelado) setDatos(c) })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar la tienda.')) })
    return () => { cancelado = true }
  }, [])

  const cambiar = (id: number, cantidad: number) => {
    const siguiente = { ...cesta }
    if (cantidad <= 0) delete siguiente[id]
    else siguiente[id] = cantidad
    setCesta(siguiente)
    guardarCesta(siguiente)
  }

  const productos = datos?.productos ?? []
  const pagoDisponible = datos?.pagoDisponible ?? false
  const metodos = datos?.metodos ?? []
  const enCesta = productos.filter((p) => cesta[p.id]).map((p) => ({ ...p, cantidad: cesta[p.id] }))
  const total = enCesta.reduce((s, p) => s + p.precio * p.cantidad, 0)
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(comprador.email.trim())
  const listo = enCesta.length > 0 && comprador.nombre.trim() !== '' && correoValido && comprador.telefono.trim().length >= 9

  const pagar = async () => {
    setEnviando(true); setError(null)
    try {
      const r = await comprar({ ...comprador, lineas: enCesta.map((p) => ({ productoId: p.id, cantidad: p.cantidad })) })
      guardarCesta({}); setCesta({})
      if (r.tipo === 'banco') irAlBanco(r)
      else navegar(`/tienda/pedido/${r.token}`)
    } catch (err: unknown) {
      setError(mensaje(err, 'No se ha podido hacer el pedido.'))
      setEnviando(false)
    }
  }

  return <>
    <MetaDePagina titulo="Tienda" descripcion={`Recuerdos ${deLaCorporacion()} ${site.titular}. Se compran en línea y se recogen en Secretaría.`} />
    <CabeceraDePagina title="Tienda" subtitle={`Recuerdos ${deLaCorporacion()}. Se pagan aquí y se recogen en Secretaría.`} />
    <ContenedorDePagina>
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {!datos && !error && <CircularProgress aria-label="Cargando la tienda" />}
        {datos && productos.length === 0 && <Alert severity="info">Ahora mismo no hay nada a la venta. Vuelve pronto.</Alert>}
        {datos && !datos.pagoDisponible && productos.length > 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>Todavía no se puede pagar en línea: estos recuerdos se compran en Secretaría.</Alert>
        )}

        {productos.length > 0 && (
          <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
              {productos.map((p) => {
                const cantidad = cesta[p.id] ?? 0
                const agotado = p.existencias === 0
                const tope = Math.min(20, p.existencias ?? 20)
                return (
                  <Paper component="li" key={p.id} sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {p.foto
                      ? <Box component="img" src={p.foto} alt={p.nombre} loading="lazy" sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
                      : <Box sx={{ width: '100%', aspectRatio: '4 / 3', bgcolor: 'action.hover' }} />}
                    <Box sx={{ p: 2.5, display: 'grid', gap: 1, flex: 1 }}>
                      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>{p.nombre}</Typography>
                      {p.descripcion && <Typography variant="body2" color="text.secondary">{p.descripcion}</Typography>}
                      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{euros(p.precio)}</Typography>
                        {agotado ? <Typography variant="body2" color="text.secondary">Agotado</Typography>
                          : pagoDisponible && (cantidad === 0
                            ? <Boton onClick={() => cambiar(p.id, 1)}>Añadir</Boton>
                            : <Stack direction="row" sx={{ alignItems: 'center' }}>
                              <IconButton aria-label={`Quitar una unidad de ${p.nombre}`} onClick={() => cambiar(p.id, cantidad - 1)}><RemoveIcon /></IconButton>
                              <Typography aria-live="polite" sx={{ minWidth: 24, textAlign: 'center' }}>{cantidad}</Typography>
                              <IconButton aria-label={`Añadir una unidad de ${p.nombre}`} disabled={cantidad >= tope} onClick={() => cambiar(p.id, cantidad + 1)}><AddIcon /></IconButton>
                            </Stack>)}
                      </Stack>
                    </Box>
                  </Paper>
                )
              })}
            </Box>

            {pagoDisponible && (
              <Paper component="aside" aria-label="Tu cesta" sx={{ p: 3, position: { md: 'sticky' }, top: { md: 96 }, display: 'grid', gap: 2 }}>
                <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Tu cesta</Typography>
                {enCesta.length === 0
                  ? <Typography variant="body2" color="text.secondary">Todavía está vacía.</Typography>
                  : <>
                    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.75 }}>
                      {enCesta.map((p) => (
                        <Box component="li" key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="body2">{p.cantidad} × {p.nombre}</Typography>
                          <Typography variant="body2">{euros(p.precio * p.cantidad)}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>Total</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{euros(total)}</Typography>
                    </Box>
                    <TextField label="Nombre y apellidos" value={comprador.nombre} onChange={(e) => setComprador({ ...comprador, nombre: e.target.value })} fullWidth slotProps={{ htmlInput: { maxLength: 120, autoComplete: 'name' } }} />
                    <TextField label="Correo" type="email" value={comprador.email} onChange={(e) => setComprador({ ...comprador, email: e.target.value })} fullWidth helperText="Te mandamos ahí la confirmación." slotProps={{ htmlInput: { autoComplete: 'email' } }} />
                    <TextField label="Teléfono" type="tel" value={comprador.telefono} onChange={(e) => setComprador({ ...comprador, telefono: e.target.value })} fullWidth slotProps={{ htmlInput: { autoComplete: 'tel' } }} />
                    {metodos.length > 1 && (
                      <TextField select label="Pagar con" fullWidth value={comprador.metodo} onChange={(e) => setComprador({ ...comprador, metodo: e.target.value as MetodoEnLinea })}>
                        {metodos.map((m) => <MenuItem key={m} value={m}>{m === 'BIZUM' ? 'Bizum' : 'Tarjeta'}</MenuItem>)}
                      </TextField>
                    )}
                    <Typography variant="body2" color="text.secondary">Se recoge en Secretaría: no hacemos envíos.</Typography>
                    <Boton onClick={() => void pagar()} disabled={!listo || enviando}>{enviando ? 'Un momento…' : `Pagar ${euros(total)}`}</Boton>
                  </>}
              </Paper>
            )}
          </Box>
        )}
      </Box>
    </ContenedorDePagina>
  </>
}
