import { useCallback, useEffect, useState } from 'react'
import { Alert, Autocomplete, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import {
  createReceipt,
  esAnioCompleto,
  generateFees,
  getAdminReceipts,
  payReceipt,
  searchReceiptBrothers,
  type AdminReceipt,
  type EmittableReceiptType,
  type PaymentMethod,
  type ReceiptBrother,
} from '../../lib/api/treasury'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'

const methods: PaymentMethod[] = ['EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION']
const statusLabels: Record<AdminReceipt['estado'], string> = { PENDIENTE: 'Pendiente', REMESADO: 'Remesado', PAGADO: 'Pagado', ANULADO: 'Anulado', DEVUELTO: 'Devuelto', EXENTO: 'Exento' }
const typeLabels: Record<EmittableReceiptType, string> = { CUOTA_HERMANO: 'Cuota de hermano', DONATIVO: 'Donativo', OTRO: 'Otro' }
const CONCEPTO_POR_DEFECTO = 'Cuota anual'

// Lo que acepta el servidor: positivo, hasta dos decimales, con punto o con coma
// («12,50» es como lo escribe cualquiera aquí).
const IMPORTE = /^\d{1,8}(?:[.,]\d{1,2})?$/
const leerImporte = (texto: string) => (IMPORTE.test(texto.trim()) ? Number(texto.trim().replace(',', '.')) : NaN)

const nombreHermano = (h: ReceiptBrother) => `${h.apellidos}, ${h.nombre}${h.numeroHermano !== null ? ` · n.º ${h.numeroHermano}` : ''}`

// Se cobra desde pendiente y desde remesado (el banco confirma la remesa).
const esCobrable = (estado: AdminReceipt['estado']) => estado === 'PENDIENTE' || estado === 'REMESADO'

// Sin tipo preseleccionado: con «Cuota de hermano» por defecto era fácil emitir
// una segunda cuota del año sin darse cuenta. El tipo decide cómo se cuenta el
// recibo, así que se elige a propósito.
interface NuevoRecibo { hermano: ReceiptBrother | null; year: string; concepto: string; importe: string; tipo: EmittableReceiptType | '' }

export default function TreasuryAdminPage() {
  const [receipts, setReceipts] = useState<AdminReceipt[]>([])
  // El año que se está viendo: filtra el listado y es el que proponen las ventanas de alta.
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [cuotas, setCuotas] = useState({ year: '', importe: '', concepto: CONCEPTO_POR_DEFECTO })
  const [generando, setGenerando] = useState(false)
  const [errorCuotas, setErrorCuotas] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<NuevoRecibo>({ hermano: null, year: '', concepto: '', importe: '', tipo: '' })
  const [emitiendo, setEmitiendo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [candidatos, setCandidatos] = useState<ReceiptBrother[]>([])
  const [buscando, setBuscando] = useState(false)
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
  // Mientras el año está a medio escribir («2», «20»…) no se pide nada: el
  // listado se queda con el último año completo en vez de parpadear.
  const load = useCallback((vigente: () => boolean = () => true) => {
    if (!esAnioCompleto(year)) return Promise.resolve()
    return getAdminReceipts(year, { pagina, porPagina }).then((response) => { if (!vigente()) return; setReceipts(response.data); setMeta(response.meta) })
  }, [year, pagina, porPagina])
  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los recibos.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  // Buscador de la ventana «Nuevo recibo»: espera a que se deje de teclear y
  // descarta las respuestas que lleguen tarde.
  const textoBusqueda = busqueda.trim()
  useEffect(() => {
    if (!emitiendo || textoBusqueda.length < 2) return
    let cancelado = false
    const temporizador = setTimeout(() => {
      setBuscando(true)
      searchReceiptBrothers(textoBusqueda)
        .then((encontrados) => { if (!cancelado) setCandidatos(encontrados) })
        .catch(() => { if (!cancelado) setCandidatos([]) })
        .finally(() => { if (!cancelado) setBuscando(false) })
    }, 300)
    return () => { cancelado = true; clearTimeout(temporizador) }
  }, [emitiendo, textoBusqueda])

  const cambiarAnio = (valor: string) => { setYear(valor); reiniciar() }

  // Tras dar de alta se pasa a ver el año de lo creado; si ya era ese, se recarga a mano.
  const verAnio = async (anio: string) => {
    if (anio !== year) cambiarAnio(anio)
    else await load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar los recibos.'))
  }

  // Se limpia al abrir, no al cerrar, y parte del año que se está viendo.
  const abrirCuotas = () => { setCuotas({ year, importe: '', concepto: CONCEPTO_POR_DEFECTO }); setErrorCuotas(null); setGenerando(true) }
  const abrirNuevo = () => { setNuevo({ hermano: null, year, concepto: '', importe: '', tipo: '' }); setBusqueda(''); setCandidatos([]); setErrorNuevo(null); setEmitiendo(true) }

  const generate = async () => {
    setWorking(true); setErrorCuotas(null); setNotice(null)
    let result: Awaited<ReturnType<typeof generateFees>>
    try { result = await generateFees({ year: Number(cuotas.year), importe: Number(cuotas.importe), concepto: cuotas.concepto }) }
    catch (err: unknown) { setErrorCuotas(err instanceof Error ? err.message : 'No se han podido generar las cuotas.'); return }
    finally { setWorking(false) }
    setGenerando(false)
    setNotice(`${result.message}${result.omitidos ? ` Omitidos: ${result.omitidos}.` : ''}`)
    await verAnio(cuotas.year)
  }

  const emitir = async () => {
    if (!nuevo.hermano || !nuevo.tipo) return
    setWorking(true); setErrorNuevo(null); setNotice(null)
    let result: Awaited<ReturnType<typeof createReceipt>>
    try { result = await createReceipt({ hermanoId: nuevo.hermano.id, year: Number(nuevo.year), concepto: nuevo.concepto.trim(), importe: leerImporte(nuevo.importe), tipo: nuevo.tipo }) }
    catch (err: unknown) { setErrorNuevo(err instanceof Error ? err.message : 'No se ha podido emitir el recibo.'); return }
    finally { setWorking(false) }
    setEmitiendo(false)
    setNotice(`${result.message} Queda pendiente de cobro.`)
    await verAnio(nuevo.year)
  }

  const pay = async (receipt: AdminReceipt) => {
    setWorking(true); setError(null); setNotice(null)
    // Un remesado lo cobra el banco: se da por cobrado por domiciliación, no
    // con el método de la mesa (que por defecto es efectivo).
    const metodo: PaymentMethod = receipt.estado === 'REMESADO' ? 'DOMICILIACION' : payment
    try { const result = await payReceipt(receipt.id, metodo); setNotice(result.message); await load() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido cobrar el recibo.') }
    finally { setWorking(false) }
  }

  const cuotasValidas = Boolean(cuotas.year) && Number(cuotas.importe) > 0 && Boolean(cuotas.concepto)
  const importeNuevo = leerImporte(nuevo.importe)
  const nuevoValido = nuevo.hermano !== null && esAnioCompleto(nuevo.year) && nuevo.concepto.trim() !== '' && importeNuevo > 0 && nuevo.tipo !== ''

  return <>
    <Helmet><title>Tesorería | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Recibos y tesorería">
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" startIcon={<ReceiptLongIcon />} onClick={abrirNuevo}>Nuevo recibo</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCuotas}>Generar cuotas</Button>
      </Stack>
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
      <Typography variant="body2" color="text.secondary">Crea un recibo por hermano para el año indicado. Se omite a quien ya tenga su cuota de ese año.</Typography>
      <TextField label="Año" type="number" value={cuotas.year} onChange={(event) => setCuotas({ ...cuotas, year: event.target.value })} fullWidth />
      <TextField label="Importe (€)" type="number" slotProps={{ htmlInput: { min: 0, step: 0.01 } }} value={cuotas.importe} onChange={(event) => setCuotas({ ...cuotas, importe: event.target.value })} fullWidth />
      <TextField label="Concepto" value={cuotas.concepto} onChange={(event) => setCuotas({ ...cuotas, concepto: event.target.value })} fullWidth />
    </VentanaFormulario>
    <VentanaFormulario
      abierto={emitiendo}
      titulo="Nuevo recibo"
      textoGuardar="Emitir recibo"
      sucio={nuevo.hermano !== null || Boolean(nuevo.concepto) || Boolean(nuevo.importe) || nuevo.tipo !== ''}
      guardando={working}
      puedeGuardar={nuevoValido}
      error={errorNuevo}
      onGuardar={emitir}
      onCerrar={() => setEmitiendo(false)}
    >
      <Typography variant="body2" color="text.secondary">Emite un recibo suelto a un hermano: una cuota que faltaba, un donativo o la reemisión de un recibo devuelto. Nace pendiente de cobro. Las papeletas de sitio se emiten en la mesa de reparto.</Typography>
      <Autocomplete
        options={textoBusqueda.length >= 2 ? candidatos : []}
        value={nuevo.hermano}
        onChange={(_, hermano) => setNuevo({ ...nuevo, hermano })}
        inputValue={busqueda}
        onInputChange={(_, texto) => setBusqueda(texto)}
        // El filtrado lo hace el servidor.
        filterOptions={(opciones) => opciones}
        getOptionLabel={nombreHermano}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        loading={buscando}
        loadingText="Buscando…"
        noOptionsText={textoBusqueda.length < 2 ? 'Escribe al menos dos letras del nombre, los apellidos o el número' : 'Ningún hermano activo coincide'}
        renderInput={(params) => <TextField {...params} label="Hermano" />}
      />
      <TextField label="Año" type="number" value={nuevo.year} onChange={(event) => setNuevo({ ...nuevo, year: event.target.value })} fullWidth />
      <TextField label="Concepto" value={nuevo.concepto} onChange={(event) => setNuevo({ ...nuevo, concepto: event.target.value })} slotProps={{ htmlInput: { maxLength: 150 } }} fullWidth />
      <TextField
        label="Importe (€)"
        value={nuevo.importe}
        onChange={(event) => setNuevo({ ...nuevo, importe: event.target.value })}
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        error={Boolean(nuevo.importe) && !(importeNuevo > 0)}
        helperText={Boolean(nuevo.importe) && !(importeNuevo > 0) ? 'Un importe mayor que cero, con dos decimales como mucho (por ejemplo, 12,50).' : undefined}
        fullWidth
      />
      <TextField select label="Tipo" value={nuevo.tipo} onChange={(event) => setNuevo({ ...nuevo, tipo: event.target.value as EmittableReceiptType })} helperText={nuevo.tipo === 'CUOTA_HERMANO' ? 'Una cuota por hermano y año: solo se emite otra si la anterior se devolvió o se anuló.' : undefined} fullWidth>
        {(Object.keys(typeLabels) as EmittableReceiptType[]).map((tipo) => <MenuItem key={tipo} value={tipo}>{typeLabels[tipo]}</MenuItem>)}
      </TextField>
    </VentanaFormulario>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
      <Typography variant="h4" sx={{ flexGrow: 1 }}>Recibos del año {year}</Typography>
      <TextField size="small" label="Año" type="number" value={year} onChange={(event) => cambiarAnio(event.target.value)} sx={{ width: { sm: 120 } }} />
      <TextField size="small" select label="Método de cobro" value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} sx={{ minWidth: { sm: 190 } }}>
        {methods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
      </TextField>
    </Stack>
    {loading ? <CircularProgress aria-label="Cargando recibos" /> : <Stack spacing={2}>{receipts.map((receipt) => <Paper key={receipt.id} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}><div><Typography variant="h6">{receipt.hermano.nombre} {receipt.hermano.apellidos}</Typography><Typography variant="body2" color="text.secondary">{receipt.concepto} · {Number(receipt.importe).toFixed(2)} € · {statusLabels[receipt.estado]}</Typography></div>{esCobrable(receipt.estado) && <Button variant="outlined" onClick={() => pay(receipt)} disabled={working} aria-label={`Cobrar ${receipt.concepto} de ${receipt.hermano.nombre} ${receipt.hermano.apellidos}`}>Cobrar</Button>}</Paper>)}{receipts.length === 0 && <Alert severity="info">No hay recibos para este año.</Alert>}</Stack>}
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="recibos" />}
  </>
}
