import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import { generateFees, getAdminReceipts, payReceipt, type AdminReceipt, type PaymentMethod } from '../../lib/api/treasury'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'

const methods: PaymentMethod[] = ['EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION']
const statusLabels: Record<AdminReceipt['estado'], string> = { PENDIENTE: 'Pendiente', REMESADO: 'Remesado', PAGADO: 'Pagado', ANULADO: 'Anulado', DEVUELTO: 'Devuelto', EXENTO: 'Exento' }
const CONCEPTO_POR_DEFECTO = 'Cuota anual'

export default function TreasuryAdminPage() {
  const [receipts, setReceipts] = useState<AdminReceipt[]>([])
  // El año que se está viendo: filtra el listado y es el que propone la ventana de generar cuotas.
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [cuotas, setCuotas] = useState({ year: '', importe: '', concepto: CONCEPTO_POR_DEFECTO })
  const [generando, setGenerando] = useState(false)
  const [errorCuotas, setErrorCuotas] = useState<string | null>(null)
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

  const cambiarAnio = (valor: string) => { setYear(valor); reiniciar() }

  // Se limpia al abrir, no al cerrar, y parte del año que se está viendo.
  const abrirCuotas = () => { setCuotas({ year, importe: '', concepto: CONCEPTO_POR_DEFECTO }); setErrorCuotas(null); setGenerando(true) }

  const generate = async () => {
    setWorking(true); setErrorCuotas(null); setNotice(null)
    let result: Awaited<ReturnType<typeof generateFees>>
    try { result = await generateFees({ year: Number(cuotas.year), importe: Number(cuotas.importe), concepto: cuotas.concepto }) }
    catch (err: unknown) { setErrorCuotas(err instanceof Error ? err.message : 'No se han podido generar las cuotas.'); return }
    finally { setWorking(false) }
    setGenerando(false)
    setNotice(`${result.message}${result.omitidos ? ` Omitidos: ${result.omitidos}.` : ''}`)
    // Se pasa a ver el año recién generado; si ya era ese, se recarga a mano.
    if (cuotas.year !== year) cambiarAnio(cuotas.year)
    else await load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar los recibos.'))
  }

  const pay = async (receipt: AdminReceipt) => {
    setWorking(true); setError(null); setNotice(null)
    try { const result = await payReceipt(receipt.id, payment); setNotice(result.message); await load() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido cobrar el recibo.') }
    finally { setWorking(false) }
  }

  const cuotasValidas = Boolean(cuotas.year) && Number(cuotas.importe) > 0 && Boolean(cuotas.concepto)

  return <>
    <Helmet><title>Tesorería | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Recibos y tesorería">
      <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCuotas}>Generar cuotas</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <VentanaFormulario
      abierto={generando}
      titulo="Generar cuotas"
      textoGuardar="Generar cuotas"
      sucio={Boolean(cuotas.importe) || cuotas.concepto !== CONCEPTO_POR_DEFECTO}
      guardando={working}
      puedeGuardar={cuotasValidas}
      error={errorCuotas}
      onGuardar={generate}
      onCerrar={() => setGenerando(false)}
    >
      <Typography variant="body2" color="text.secondary">Crea un recibo por hermano para el año indicado. Los que ya lo tengan se omiten.</Typography>
      <TextField label="Año" type="number" value={cuotas.year} onChange={(event) => setCuotas({ ...cuotas, year: event.target.value })} fullWidth />
      <TextField label="Importe (€)" type="number" slotProps={{ htmlInput: { min: 0, step: 0.01 } }} value={cuotas.importe} onChange={(event) => setCuotas({ ...cuotas, importe: event.target.value })} fullWidth />
      <TextField label="Concepto" value={cuotas.concepto} onChange={(event) => setCuotas({ ...cuotas, concepto: event.target.value })} fullWidth />
    </VentanaFormulario>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
      <Typography variant="h4" sx={{ flexGrow: 1 }}>Recibos del año {year}</Typography>
      <TextField size="small" label="Año" type="number" value={year} onChange={(event) => cambiarAnio(event.target.value)} sx={{ width: { sm: 120 } }} />
      <TextField size="small" select label="Método de cobro" value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} sx={{ minWidth: { sm: 190 } }}>
        {methods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
      </TextField>
    </Stack>
    {loading ? <CircularProgress aria-label="Cargando recibos" /> : <Stack spacing={2}>{receipts.map((receipt) => <Paper key={receipt.id} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}><div><Typography variant="h6">{receipt.hermano.nombre} {receipt.hermano.apellidos}</Typography><Typography variant="body2" color="text.secondary">{receipt.concepto} · {Number(receipt.importe).toFixed(2)} € · {statusLabels[receipt.estado]}</Typography></div>{receipt.estado === 'PENDIENTE' && <Button variant="outlined" onClick={() => pay(receipt)} disabled={working}>Cobrar</Button>}</Paper>)}{receipts.length === 0 && <Alert severity="info">No hay recibos para este año.</Alert>}</Stack>}
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="recibos" />}
  </>
}
