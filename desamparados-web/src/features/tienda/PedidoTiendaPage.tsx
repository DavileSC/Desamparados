import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import MetaDePagina from '../../components/MetaDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import { pedidoPublico, type PedidoPublico } from '../../lib/api/tienda'
import { nombreConTalla } from './cesta'

const euros = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
/** El aviso del banco puede llegar unos segundos después que la persona: se pregunta un rato. */
const ESPERA_MS = 3000
const INTENTOS = 20

/**
 * La vuelta del banco (o del pago simulado): cómo va el pedido. Mientras el
 * banco no avisa, se sigue preguntando un minuto; después, se dice que llegará
 * el correo.
 */
export default function PedidoTiendaPage() {
  const token = useParams().token ?? ''
  const [params] = useSearchParams()
  const fallo = params.get('resultado') === 'no'
  const [pedido, setPedido] = useState<PedidoPublico | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intentos, setIntentos] = useState(0)

  useEffect(() => {
    let cancelado = false
    let hechos = 0
    // Se deja de preguntar en cuanto hay respuesta del banco, se agotan los
    // intentos o el banco ya dijo que no (entonces basta con una vez).
    const preguntar = () => pedidoPublico(token)
      .then((p) => {
        if (cancelado) return
        hechos += 1
        setPedido(p); setIntentos(hechos)
        if (p.estado !== 'PENDIENTE_PAGO' || fallo || hechos >= INTENTOS) clearInterval(reloj)
      })
      .catch((err: unknown) => { if (!cancelado) { clearInterval(reloj); setError(err instanceof Error ? err.message : 'No se encuentra el pedido.') } })
    const reloj = setInterval(() => void preguntar(), ESPERA_MS)
    void preguntar()
    return () => { cancelado = true; clearInterval(reloj) }
  }, [token, fallo])

  const esperando = pedido?.estado === 'PENDIENTE_PAGO' && !fallo && intentos < INTENTOS

  return <>
    <MetaDePagina titulo="Tu pedido" sinIndexar />
    <CabeceraDePagina title={pedido ? `Pedido n.º ${pedido.numero}` : 'Tu pedido'} />
    <ContenedorDePagina>
      <Box sx={{ py: { xs: 4, md: 6 }, maxWidth: 640 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!pedido && !error && <CircularProgress aria-label="Cargando el pedido" />}
        {pedido && <>
          {(pedido.estado === 'PAGADO' || pedido.estado === 'ENTREGADO') && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {pedido.estado === 'PAGADO'
                ? `Pedido pagado, ${pedido.nombre}. Recógelo en Secretaría: te hemos mandado la confirmación por correo.`
                : 'Este pedido ya está entregado. ¡Gracias!'}
            </Alert>
          )}
          {pedido.estado === 'PENDIENTE_PAGO' && (esperando
            ? <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mb: 3 }}>Esperando la confirmación del banco…</Alert>
            : <Alert severity={fallo ? 'warning' : 'info'} sx={{ mb: 3 }}>
              {fallo
                ? 'El pago no se ha completado y no se ha cobrado nada. Puedes volver a la tienda e intentarlo otra vez.'
                : 'El banco aún no ha confirmado el pago. Si se completó, te llegará el correo de confirmación en unos minutos.'}
            </Alert>)}
          {pedido.estado === 'CANCELADO' && <Alert severity="warning" sx={{ mb: 3 }}>Este pedido está anulado.</Alert>}
          <Paper sx={{ p: 3, display: 'grid', gap: 0.75 }}>
            {pedido.lineas.map((l, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography>{l.cantidad} × {nombreConTalla(l.nombre, l.talla)}</Typography>
                <Typography>{euros(l.precio * l.cantidad)}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 1, mt: 0.5 }}>
              <Typography sx={{ fontWeight: 600 }}>Total</Typography>
              <Typography sx={{ fontWeight: 600 }}>{euros(pedido.total)}</Typography>
            </Box>
          </Paper>
          <Box sx={{ mt: 3 }}><Boton component={Link} to="/tienda">Volver a la tienda</Boton></Box>
        </>}
      </Box>
    </ContenedorDePagina>
  </>
}
