import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress } from '@mui/material'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import MetaDePagina from '../../components/MetaDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import { apadrinamientoPublico, type ApadrinamientoPublico } from '../../lib/api/apadrinamientos'

const euros = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const ESPERA_MS = 3000
const INTENTOS = 20

/** La vuelta del banco: si el apadrinamiento ya consta, las gracias; si no, se espera un minuto al aviso. */
export default function GraciasApadrinamientoPage() {
  const token = useParams().token ?? ''
  const fallo = useSearchParams()[0].get('resultado') === 'no'
  const [a, setA] = useState<ApadrinamientoPublico | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intentos, setIntentos] = useState(0)

  useEffect(() => {
    let cancelado = false
    let hechos = 0
    const preguntar = () => apadrinamientoPublico(token)
      .then((x) => {
        if (cancelado) return
        hechos += 1
        setA(x); setIntentos(hechos)
        if (x.estado !== 'PENDIENTE_PAGO' || fallo || hechos >= INTENTOS) clearInterval(reloj)
      })
      .catch((err: unknown) => { if (!cancelado) { clearInterval(reloj); setError(err instanceof Error ? err.message : 'No se encuentra el apadrinamiento.') } })
    const reloj = setInterval(() => void preguntar(), ESPERA_MS)
    void preguntar()
    return () => { cancelado = true; clearInterval(reloj) }
  }, [token, fallo])

  const esperando = a?.estado === 'PENDIENTE_PAGO' && !fallo && intentos < INTENTOS
  return <>
    <MetaDePagina titulo="Gracias por apadrinar" sinIndexar />
    <CabeceraDePagina title={a?.estado === 'PAGADO' ? 'Gracias' : 'Tu apadrinamiento'} />
    <ContenedorDePagina>
      <Box sx={{ py: { xs: 4, md: 6 }, maxWidth: 640, display: 'grid', gap: 3 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!a && !error && <CircularProgress aria-label="Cargando" />}
        {a?.estado === 'PAGADO' && <Alert severity="success">{`Gracias, ${a.nombre}. Has apadrinado ${a.pieza} en «${a.campana}» con ${euros(a.importe)}. Te hemos mandado la confirmación por correo.`}</Alert>}
        {a?.estado === 'PENDIENTE_PAGO' && (esperando
          ? <Alert severity="info" icon={<CircularProgress size={18} />}>Esperando la confirmación del banco…</Alert>
          : <Alert severity={fallo ? 'warning' : 'info'}>{fallo ? 'El pago no se ha completado y no se ha cobrado nada. Puedes volver a intentarlo.' : 'El banco aún no ha confirmado el pago. Si se completó, te llegará el correo en unos minutos.'}</Alert>)}
        {a && <Box><Boton component={Link} to="/apadrina">Volver a las fotos</Boton></Box>}
      </Box>
    </ContenedorDePagina>
  </>
}
