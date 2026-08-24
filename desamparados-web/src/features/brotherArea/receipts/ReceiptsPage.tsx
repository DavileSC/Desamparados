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
import { receipts } from '../../../lib/mocks/brother'

const statusConfig = {
  paid: { label: 'Pagado', color: 'success.main' },
  pending: { label: 'Pendiente', color: 'warning.main' },
  overdue: { label: 'Vencido', color: 'error.main' },
}

export default function ReceiptsPage() {
  return (
    <>
      <Helmet>
        <title>Recibos | Desamparados</title>
      </Helmet>

      <AnimatedSection component="section" sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Recibos
          </Typography>

          <TableContainer component={Paper} sx={{ backgroundColor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Año</TableCell>
                  <TableCell>Concepto</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Importe</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receipts.map((receipt) => {
                  const status = statusConfig[receipt.status]
                  return (
                    <TableRow key={receipt.id}>
                      <TableCell>{receipt.year}</TableCell>
                      <TableCell>{receipt.concept}</TableCell>
                      <TableCell>
                        {new Date(receipt.date).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell align="right">{receipt.amount.toFixed(2)} €</TableCell>
                      <TableCell>
                        <Box
                          component="span"
                          sx={{ color: status.color, fontWeight: 600, textTransform: 'uppercase' }}
                        >
                          {status.label}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
