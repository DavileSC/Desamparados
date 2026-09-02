import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { generateFees, getAdminReceipts, payReceipt, type AdminReceipt, type PaymentMethod } from '../../lib/api/treasury'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

const methods: PaymentMethod[] = ['EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION']
const statusLabels: Record<AdminReceipt['estado'], string> = { PENDIENTE: 'Pendiente', REMESADO: 'Remesado', PAGADO: 'Pagado', ANULADO: 'Anulado', DEVUELTO: 'Devuelto', EXENTO: 'Exento' }

export default function TreasuryAdminPage() {
  const [receipts, setReceipts] = useState<AdminReceipt[]>([])
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('Cuota anual')
  const [payment, setPayment] = useState<PaymentMethod>('EFECTIVO')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano, reiniciar } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de generar o cobrar la omiten: no hay carrera.
  const load = useCallback((vigente: () => boolean = () => true) => getAdminReceipts(year, { pagina, porPagina }).then((response) => { if (!vigente()) return; setReceipts(response.data); setMeta(response.meta) }), [year, pagina, porPagina])
  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los recibos.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  const generate = async () => {
    setWorking(true); setError(null); setNotice(null)
    try { const result = await generateFees({ year: Number(year), importe: Number(amount), concepto: concept }); setNotice(`${result.message}${result.omitidos ? ` Omitidos: ${result.omitidos}.` : ''}`); setAmount(''); await load() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se han podido generar las cuotas.') }
    finally { setWorking(false) }
  }

  const pay = async (receipt: AdminReceipt) => {
    setWorking(true); setError(null); setNotice(null)
    try { const result = await payReceipt(receipt.id, payment); setNotice(result.message); await load() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido cobrar el recibo.') }
    finally { setWorking(false) }
  }

  return <>
    <Helmet><title>Tesorería | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <Typography variant="h2" component="h1" sx={{ mb: 4 }}>Recibos y tesorería</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <Paper sx={{ p: { xs: 2, md: 4 }, mb: 4 }}><Typography variant="h4" sx={{ mb: 2 }}>Generar cuotas</Typography><Stack spacing={2}><TextField label="Año" type="number" value={year} onChange={(event) => { setYear(event.target.value); reiniciar() }} /><TextField label="Importe" type="number" slotProps={{ htmlInput: { min: 0, step: 0.01 } }} value={amount} onChange={(event) => setAmount(event.target.value)} /><TextField label="Concepto" value={concept} onChange={(event) => setConcept(event.target.value)} /><Button variant="contained" onClick={generate} disabled={working || !amount || Number(amount) <= 0 || !concept}>Generar cuotas</Button></Stack></Paper>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}><Typography variant="h4" sx={{ flexGrow: 1 }}>Recibos del año {year}</Typography><Select value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} aria-label="Método de pago">{methods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}</Select></Stack>
    {loading ? <CircularProgress aria-label="Cargando recibos" /> : <Stack spacing={2}>{receipts.map((receipt) => <Paper key={receipt.id} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}><div><Typography variant="h6">{receipt.hermano.nombre} {receipt.hermano.apellidos}</Typography><Typography variant="body2" color="text.secondary">{receipt.concepto} · {Number(receipt.importe).toFixed(2)} € · {statusLabels[receipt.estado]}</Typography></div>{receipt.estado === 'PENDIENTE' && <Button variant="outlined" onClick={() => pay(receipt)} disabled={working}>Cobrar</Button>}</Paper>)}{receipts.length === 0 && <Alert severity="info">No hay recibos para este año.</Alert>}</Stack>}
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="recibos" />}
  </>
}
