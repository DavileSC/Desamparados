import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { incidenciasDePago, resolverIncidenciaDePago, type IncidenciaDePago } from '../../../lib/api/tesoreria'
import { NOMBRE_METODO } from '../mesa/formato'
import { euros } from '../../../lib/euros'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'

/** De dónde venía el pago: no es lo mismo devolver una cuota que un pedido. */
const ORIGEN: Record<IncidenciaDePago['origen'], string> = { AREA_HERMANOS: 'Área de hermanos', TIENDA: 'Tienda', APADRINAMIENTO: 'Apadrinamiento' }

const fecha = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Los pagos en línea que el banco cobró y no se pudieron aplicar (el recibo
 * ya estaba pagado, cambió el importe…). El dinero está en la cuenta y no es
 * de nadie: hasta que Tesorería lo devuelva y lo marque, sale aquí arriba.
 * Sin incidencias no se enseña nada.
 */
export default function IncidenciasDePago() {
  const cliente = useQueryClient()
  const [lista, setLista] = useState<IncidenciaDePago[]>([])
  const [error, setError] = useState<string | null>(null)
  const [resolviendo, setResolviendo] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // La que espera confirmación para resolverse anulando su pedido.
  const [anulando, setAnulando] = useState<IncidenciaDePago | null>(null)

  const cargar = useCallback(() => incidenciasDePago().then(setLista), [])
  useEffect(() => {
    let cancelado = false
    incidenciasDePago().then((l) => { if (!cancelado) setLista(l) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [])

  const resolver = async (id: number, anular = false) => {
    setResolviendo(id)
    setError(null); setAviso(null)
    try {
      const { message } = await resolverIncidenciaDePago(id, { anular })
      // El pedido anulado deja de estar donde estaba en la lista de la Tienda.
      if (anular) { setAviso(message); void cliente.invalidateQueries({ queryKey: ['tienda', 'pedidos'] }) }
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido marcar como resuelta.')
    } finally {
      setResolviendo(null)
    }
  }

  // Una respuesta rara (una versión vieja del servidor) no debe tumbar Tesorería.
  // El aviso de lo anulado se queda aunque ya no queden incidencias.
  if (!Array.isArray(lista) || lista.length === 0) return aviso ? <Alert severity="success" sx={{ mb: 3 }} onClose={() => setAviso(null)}>{aviso}</Alert> : null
  return (<>
    {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}
    <Alert severity="warning" sx={{ mb: 3 }}>
      <AlertTitle>{lista.length === 1 ? 'Un pago en línea por devolver' : `${lista.length} pagos en línea por devolver`}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        El banco los cobró, pero no se pudieron aplicar a lo que se debía. Devuelve el dinero desde el portal del banco (con el número de pedido) y márcalo aquí.
      </Typography>
      {error && <Typography variant="body2" color="error" sx={{ mb: 1 }}>{error}</Typography>}
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1.5 }}>
        {lista.map((i) => (
          <Box component="li" key={i.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {euros(i.importe)} · {NOMBRE_METODO[i.metodo] ?? i.metodo} · pedido {i.pedido}{i.autorizacion ? ` · autorización ${i.autorizacion}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {fecha.format(new Date(i.fecha))} · {ORIGEN[i.origen] ?? i.origen}{i.correo ? ` · ${i.correo}` : ''} · {i.motivo}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button size="small" variant="outlined" color="inherit" disabled={resolviendo === i.id} onClick={() => void resolver(i.id)}>
                Devuelto
              </Button>
              {/* Un pedido de la tienda cobrado y sin completar no tiene otra salida.
                  Solo cuando el servidor dice que se puede: una cuota o un pedido ya
                  borrado se resuelven con «Devuelto» a secas. */}
              {i.anulable && (
                <Button size="small" variant="outlined" color="inherit" disabled={resolviendo === i.id} onClick={() => setAnulando(i)}>
                  Devuelto y anular el pedido
                </Button>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Alert>
    <DialogoConfirmacion
      abierto={anulando !== null}
      titulo="¿Anular el pedido de este pago?"
      mensaje={anulando ? `Se da por devuelto el pago de ${euros(anulando.importe)} (pedido ${anulando.pedido}) y se anula el pedido de la tienda que pagaba, para que no se quede esperando. Devuelve antes el dinero desde el portal del banco. Solo vale para pedidos de la tienda. No se puede deshacer.` : ''}
      textoConfirmar="Devuelto y anular"
      textoCancelar="Volver"
      peligro
      onConfirmar={() => { if (anulando) { const id = anulando.id; setAnulando(null); void resolver(id, true) } }}
      onCancelar={() => setAnulando(null)}
    />
  </>)
}
