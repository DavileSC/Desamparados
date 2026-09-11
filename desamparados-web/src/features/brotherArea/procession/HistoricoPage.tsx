import {
  Alert,
  Box,
  CircularProgress,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import Paginador from '../../../components/Paginador'
import { useListadoPaginado } from '../../../hooks/useListadoPaginado'
import { getMyProcessionTickets, type ApiProcessionTicket } from '../../../lib/api/procession'
import { estadoPapeleta } from './estadoPapeleta'

export default function HistoricoPage() {
  const { items: tickets, meta, loading, error, alCambiarPagina, cambiarTamano } =
    useListadoPaginado<ApiProcessionTicket>(getMyProcessionTickets, 'No se ha podido cargar el histórico.')

  return (
    <>
      <Helmet>
        <title>Histórico de Procesiones | Desamparados</title>
      </Helmet>

      <AnimatedSection sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Histórico de Procesiones
          </Typography>

          {loading && <CircularProgress aria-label="Cargando histórico" sx={{ mb: 4 }} />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}
          {!loading && !error && tickets.length === 0 && (
            <Alert severity="info">Todavía no hay papeletas registradas.</Alert>
          )}

          {!loading && !error && tickets.length > 0 && <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Hermano</TableCell>
                  <TableCell>Año</TableCell>
                  <TableCell>Sección</TableCell>
                  <TableCell>Sitio</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.hermano.nombre} {ticket.hermano.apellidos}</TableCell>
                    <TableCell>{ticket.year}</TableCell>
                    <TableCell>{ticket.puesto}</TableCell>
                    <TableCell>{ticket.tramo ?? (ticket.numero !== null ? `Número ${ticket.numero}` : 'Pendiente de asignar')}</TableCell>
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          color: estadoPapeleta(ticket.recibo.estado).color,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {estadoPapeleta(ticket.recibo.estado).texto}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>}

          {meta && <Paginador meta={meta} onPagina={alCambiarPagina} onTamano={cambiarTamano} etiqueta="mi histórico de papeletas" />}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
