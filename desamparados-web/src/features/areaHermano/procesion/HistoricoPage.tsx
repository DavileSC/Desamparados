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
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import Paginador from '../../../components/Paginador'
import { useListadoPaginado } from '../../../hooks/useListadoPaginado'
import { misPapeletas, type ApiProcessionTicket } from '../../../lib/api/procesion'
import { estadoPapeleta } from './estadoPapeleta'
import AvisoSuave from '../../../components/AvisoSuave'
import { site } from '../../../config/site'

export default function HistoricoPage() {
  const { items: tickets, meta, loading, error, alCambiarPagina, cambiarTamano } =
    useListadoPaginado<ApiProcessionTicket>(misPapeletas, 'No se ha podido cargar el histórico.')

  return (
    <>
      <Helmet>
        <title>{`Histórico de Procesiones | ${site.nombreCorto}`}</title>
      </Helmet>

      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Histórico de Procesiones
          </Typography>

          {loading && <CircularProgress aria-label="Cargando histórico" sx={{ mb: 4 }} />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}
          {!loading && !error && tickets.length === 0 && (
            <AvisoSuave>Todavía no hay papeletas registradas.</AvisoSuave>
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
                    <TableCell>{ticket.year}{ticket.salida === 'ROSARIO' ? ' · Rosario' : ''}</TableCell>
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
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
