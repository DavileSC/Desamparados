import { useEffect, useState } from 'react'
import { Alert, CircularProgress, Typography, Grid } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'
import AppButton from '../../../components/AppButton'
import { getMyProcessionTickets, type ApiProcessionTicket } from '../../../lib/api/procession'

export default function PapeletaPage() {
  const [tickets, setTickets] = useState<ApiProcessionTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getMyProcessionTickets()
      .then((data) => {
        if (!cancelled) setTickets(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se ha podido cargar tu papeleta.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // La API ordena por año descendente; la primera es la más reciente.
  const ticket = tickets[0] ?? null

  return (
    <>
      <Helmet>
        <title>Papeleta de Sitio | Desamparados</title>
      </Helmet>

      <AnimatedSection sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Papeleta de Sitio
          </Typography>

          {loading && <CircularProgress aria-label="Cargando papeleta" sx={{ mb: 4 }} />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

          {!loading && !error && !ticket ? (
            <GlassCard sx={{ p: { xs: 3, md: 5 }, maxWidth: '600px' }}>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
                Todavía no tienes papeleta de sitio asignada para este año.
              </Typography>
              <AppButton component={Link} to="/area-hermano/procesion">
                Solicitar papeleta
              </AppButton>
            </GlassCard>
          ) : !loading && !error && ticket ? (
            <GlassCard sx={{ p: { xs: 3, md: 5 }, maxWidth: '600px' }}>
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
                      color:
                        ticket.recibo.estado === 'PAGADO'
                          ? 'success.main'
                          : ticket.recibo.estado === 'PENDIENTE' || ticket.recibo.estado === 'REMESADO'
                            ? 'warning.main'
                            : 'error.main',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {ticket.recibo.estado === 'PAGADO' && 'Asignada'}
                    {(ticket.recibo.estado === 'PENDIENTE' || ticket.recibo.estado === 'REMESADO') && 'Pendiente'}
                    {ticket.recibo.estado !== 'PAGADO' && ticket.recibo.estado !== 'PENDIENTE' && ticket.recibo.estado !== 'REMESADO' && 'No disponible'}
                  </Typography>
                </Grid>
              </Grid>
            </GlassCard>
          ) : null}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
