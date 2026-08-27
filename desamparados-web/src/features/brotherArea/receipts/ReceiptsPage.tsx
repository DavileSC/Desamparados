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
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import { getMyReceipts, type ApiReceipt, type ReceiptStatus } from '../../../lib/api/receipts'

const statusConfig: Record<ReceiptStatus, { label: string; color: string }> = {
  PAGADO: { label: 'Pagado', color: 'success.main' },
  PENDIENTE: { label: 'Pendiente', color: 'warning.main' },
  REMESADO: { label: 'Remesado', color: 'info.main' },
  DEVUELTO: { label: 'Devuelto', color: 'error.main' },
  ANULADO: { label: 'Anulado', color: 'error.main' },
  EXENTO: { label: 'Exento', color: 'text.secondary' },
}

interface DisplayReceipt extends ApiReceipt {
  memberName: string
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<DisplayReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getMyReceipts()
      .then((groups) => {
        if (cancelled) return
        setReceipts(
          groups.flatMap((group) =>
            group.recibos.map((receipt) => ({
              ...receipt,
              memberName: `${group.nombre} ${group.apellidos}`,
            }))
          )
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se han podido cargar tus recibos.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Helmet>
        <title>Recibos | Desamparados</title>
      </Helmet>

      <AnimatedSection sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Recibos
          </Typography>

          {loading && <CircularProgress aria-label="Cargando recibos" sx={{ mb: 4 }} />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}
          {!loading && !error && receipts.length === 0 && (
            <Alert severity="info">No hay recibos disponibles para tu familia.</Alert>
          )}

          {!loading && !error && receipts.length > 0 && <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Hermano</TableCell>
                  <TableCell>Año</TableCell>
                  <TableCell>Concepto</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Importe</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receipts.map((receipt) => {
                  const status = statusConfig[receipt.estado]
                  return (
                    <TableRow key={receipt.id}>
                      <TableCell>{receipt.memberName}</TableCell>
                      <TableCell>{receipt.year}</TableCell>
                      <TableCell>{receipt.concepto}</TableCell>
                      <TableCell>
                        {new Date(receipt.fechaPago ?? receipt.fechaEmision).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell align="right">{Number(receipt.importe).toFixed(2)} €</TableCell>
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
          </TableContainer>}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
