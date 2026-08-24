import {
  Box,
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
import { processionTickets } from '../../../lib/mocks/brother'

export default function HistoricoPage() {
  return (
    <>
      <Helmet>
        <title>Histórico de Procesiones | Desamparados</title>
      </Helmet>

      <AnimatedSection component="section" sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Histórico de Procesiones
          </Typography>

          <TableContainer component={Paper} sx={{ backgroundColor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Año</TableCell>
                  <TableCell>Sección</TableCell>
                  <TableCell>Sitio</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processionTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.year}</TableCell>
                    <TableCell>{ticket.section}</TableCell>
                    <TableCell>{ticket.seat}</TableCell>
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          color:
                            ticket.status === 'assigned'
                              ? 'success.main'
                              : ticket.status === 'pending'
                                ? 'warning.main'
                                : 'error.main',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {ticket.status === 'assigned' && 'Asignada'}
                        {ticket.status === 'pending' && 'Pendiente'}
                        {ticket.status === 'not-assigned' && 'No asignada'}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
