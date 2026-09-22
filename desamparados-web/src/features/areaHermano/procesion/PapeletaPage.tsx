import { useEffect, useState } from 'react'
import { Alert, CircularProgress, Typography, Grid } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import { misPapeletas, type ApiProcessionTicket } from '../../../lib/api/procesion'
import { estadoPapeleta } from './estadoPapeleta'

export default function PapeletaPage() {
  const [tickets, setTickets] = useState<ApiProcessionTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    // La papeleta vigente es la más reciente y el servidor ordena por año
    // descendente: con la primera página basta, no hace falta el histórico entero.
    misPapeletas({ pagina: 1, porPagina: 10 })
      .then((respuesta) => {
        if (!cancelado) setTickets(respuesta.data)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar tu papeleta.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [])

  // La API ordena por año descendente; la primera es la más reciente.
  const ticket = tickets[0] ?? null

  return (
    <>
      <Helmet>
        <title>Papeleta de Sitio | Desamparados</title>
      </Helmet>

      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Papeleta de Sitio
          </Typography>

          {loading && <CircularProgress aria-label="Cargando papeleta" sx={{ mb: 4 }} />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

          {!loading && !error && !ticket ? (
            <TarjetaCristal sx={{ p: { xs: 3, md: 5 }, maxWidth: '600px' }}>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
                Todavía no tienes papeleta de sitio asignada para este año.
              </Typography>
              <Boton component={Link} to="/area-hermano/procesion">
                Solicitar papeleta
              </Boton>
            </TarjetaCristal>
          ) : !loading && !error && ticket ? (
            <TarjetaCristal sx={{ p: { xs: 3, md: 5 }, maxWidth: '600px' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                {ticket.hermano.nombre} {ticket.hermano.apellidos}
              </Typography>
              <Typography variant="overline" sx={{ color: 'secondary.main', display: 'block', mb: 2 }}>
                Año {ticket.year}
              </Typography>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                    Sección
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
                    {ticket.puesto}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                    Sitio
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
                    {ticket.tramo ?? (ticket.numero !== null ? `Número ${ticket.numero}` : 'Pendiente de asignar')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                    Estado
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: estadoPapeleta(ticket.recibo.estado).color,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {estadoPapeleta(ticket.recibo.estado).texto}
                  </Typography>
                </Grid>
              </Grid>
            </TarjetaCristal>
          ) : null}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
