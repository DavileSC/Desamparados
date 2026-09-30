import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material'
import { incidenciasDePago, resolverIncidenciaDePago, type IncidenciaDePago } from '../../../lib/api/tesoreria'
import { NOMBRE_METODO } from '../mesa/formato'

const fecha = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/**
 * Los pagos en línea que el banco cobró y no se pudieron aplicar (el recibo
 * ya estaba pagado, cambió el importe…). El dinero está en la cuenta y no es
 * de nadie: hasta que Tesorería lo devuelva y lo marque, sale aquí arriba.
 * Sin incidencias no se enseña nada.
 */
export default function IncidenciasDePago() {
  const [lista, setLista] = useState<IncidenciaDePago[]>([])
  const [error, setError] = useState<string | null>(null)
  const [resolviendo, setResolviendo] = useState<number | null>(null)

  const cargar = useCallback(() => incidenciasDePago().then(setLista), [])
  useEffect(() => {
    let cancelado = false
    incidenciasDePago().then((l) => { if (!cancelado) setLista(l) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [])

  const resolver = async (id: number) => {
    setResolviendo(id)
    setError(null)
    try {
      await resolverIncidenciaDePago(id)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido marcar como resuelta.')
    } finally {
      setResolviendo(null)
    }
  }

  // Una respuesta rara (una versión vieja del servidor) no debe tumbar Tesorería.
  if (!Array.isArray(lista) || lista.length === 0) return null
  return (
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
                {euros.format(i.importe)} · {NOMBRE_METODO[i.metodo] ?? i.metodo} · pedido {i.pedido}{i.autorizacion ? ` · autorización ${i.autorizacion}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {fecha.format(new Date(i.fecha))}{i.correo ? ` · ${i.correo}` : ''} · {i.motivo}
              </Typography>
            </Box>
            <Button size="small" variant="outlined" color="inherit" disabled={resolviendo === i.id} onClick={() => void resolver(i.id)}>
              Devuelto
            </Button>
          </Box>
        ))}
      </Box>
    </Alert>
  )
}
