import { useCallback, useEffect, useState } from 'react'
import { Alert, Autocomplete, Button, CircularProgress, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../altas/auth/store'
import ListaImpagos from './impagos/ListaImpagos'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import {
  crearRecibo,
  esAnioCompleto,
  generarCuotas,
  recibosDelCms,
  resumenDeRecibos,
  cobrarRecibo,
  cambiarEstadoRecibo,
  buscarHermanosConRecibo,
  type AdminReceipt,
  type AdminReceiptStatus,
  type EmittableReceiptType,
  type FiltrosRecibos,
  type PaymentMethod,
  type ReceiptBrother,
  type ReceiptType,
  type ResumenRecibos,
} from '../../lib/api/tesoreria'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import BarraListado, { type Opcion } from './listados/BarraListado'
import { useFiltrosUrl } from './listados/useFiltrosUrl'
import ContadoresEstado from './tesoreria/ContadoresEstado'
import ListaRecibos from './tesoreria/ListaRecibos'
import { NOMBRE_METODO } from './mesa/formato'
import DialogoEstado, { type CambioEstado } from './tesoreria/DialogoEstado'
import IncidenciasDePago from './tesoreria/IncidenciasDePago'
import Remesas from './tesoreria/Remesas'

const methods: PaymentMethod[] = ['EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION']
const statusLabels: Record<AdminReceipt['estado'], string> = { PENDIENTE: 'Pendiente', REMESADO: 'Remesado', PAGADO: 'Pagado', ANULADO: 'Anulado', DEVUELTO: 'Devuelto', EXENTO: 'Exento' }
const typeLabels: Record<EmittableReceiptType, string> = { CUOTA_HERMANO: 'Cuota de hermano', DONATIVO: 'Donativo', OTRO: 'Otro' }
// Para filtrar sí entra la papeleta, aunque no se emita desde aquí.
const tiposRecibo: Record<ReceiptType, string> = { PAPELETA_SITIO: 'Papeleta de sitio', ...typeLabels }
const CONCEPTO_POR_DEFECTO = 'Cuota anual'

const aOpciones = <K extends string>(etiquetas: Record<K, string>): Opcion[] =>
  (Object.entries(etiquetas) as [K, string][]).map(([valor, etiqueta]) => ({ valor, etiqueta }))
const ESTADOS_RECIBO = aOpciones(statusLabels)
const TIPOS_RECIBO = aOpciones(tiposRecibo)
const ORDENES_RECIBOS: Opcion[] = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'antiguos', etiqueta: 'Más antiguos' },
  { valor: 'hermano', etiqueta: 'Hermano (A-Z)' },
  { valor: 'numero', etiqueta: 'Número de hermano' },
  { valor: 'importeDesc', etiqueta: 'Importe: mayor primero' },
  { valor: 'importeAsc', etiqueta: 'Importe: menor primero' },
]
const valoresDe = (opciones: Opcion[]) => opciones.map((o) => o.valor)
const FILTROS_RECIBOS = {
  q: {},
  estado: { validos: valoresDe(ESTADOS_RECIBO) },
  tipo: { validos: valoresDe(TIPOS_RECIBO) },
  orden: { porDefecto: 'recientes', validos: valoresDe(ORDENES_RECIBOS) },
  // Un recibo concreto, al llegar desde un apunte de Contabilidad.
  recibo: {},
}

// Lo que acepta el servidor: positivo, hasta dos decimales, con punto o con coma
// («12,50» es como lo escribe cualquiera aquí).
const IMPORTE = /^\d{1,8}(?:[.,]\d{1,2})?$/
const leerImporte = (texto: string) => (IMPORTE.test(texto.trim()) ? Number(texto.trim().replace(',', '.')) : NaN)

const nombreHermano = (h: ReceiptBrother) => `${h.apellidos}, ${h.nombre}${h.numeroHermano !== null ? ` · n.º ${h.numeroHermano}` : ''}`

// Sin tipo preseleccionado: con «Cuota de hermano» por defecto era fácil emitir
// una segunda cuota del año sin darse cuenta. El tipo decide cómo se cuenta el
// recibo, así que se elige a propósito.
interface NuevoRecibo { hermano: ReceiptBrother | null; year: string; concepto: string; importe: string; tipo: EmittableReceiptType | '' }

export default function TesoreriaAdminPage() {
  const [params, setParams] = useSearchParams()
  const vistaPedida = params.get('vista')
  const vista = vistaPedida === 'impagos' || vistaPedida === 'remesas' ? vistaPedida : 'recibos'
  // La baja es de Secretaría: aquí solo la dan quienes también gestionan el censo.
  const role = useAuthStore((state) => state.cms?.role ?? 'USER')
  const puedeDarDeBaja = role === 'ADMIN' || role === 'HERMANO_MAYOR'
  const [receipts, setReceipts] = useState<AdminReceipt[]>([])
  // El año que se está viendo: filtra el listado y es el que proponen las ventanas de alta.
  // Vacío, se ven todos los años. Va aparte de los filtros de la URL porque se
  // teclea: con la URL de por medio, borrarlo para escribir otro lo rellenaría.
  // Los enlaces de Contabilidad piden todos los años: `?anio=todos`, o un recibo
  // concreto, que puede ser de cualquiera.
  const [year, setYear] = useState(() => (params.get('anio') === 'todos' || params.get('recibo') ? '' : String(new Date().getFullYear())))
  // Búsqueda, estado, tipo y orden, en la URL como la página.
  const [filtros, cambiarFiltros] = useFiltrosUrl(FILTROS_RECIBOS)
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
  const [cambio, setCambio] = useState<CambioEstado | null>(null)
  const [errorCambio, setErrorCambio] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano, reiniciar } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [resumen, setResumen] = useState<ResumenRecibos | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de generar o cobrar la omiten: no hay carrera.
  // Mientras el año está a medio escribir («2», «20»…) no se pide nada: el
  // listado se queda con el último año completo en vez de parpadear.
  const cargar = useCallback((vigente: () => boolean = () => true) => {
    if (year && !esAnioCompleto(year)) return Promise.resolve()
    const { q, tipo, recibo } = filtros as FiltrosRecibos
    return Promise.all([
      recibosDelCms(year, { pagina, porPagina }, filtros as FiltrosRecibos),
      // Los contadores, con los mismos filtros menos el estado: son los que lo eligen.
      resumenDeRecibos(year, { q, tipo, recibo }),
    ]).then(([response, cifras]) => {
      if (!vigente()) return
      setReceipts(response.data); setMeta(response.meta)
      setResumen(cifras?.estados ? cifras : null)
    })
  }, [year, pagina, porPagina, filtros])
  useEffect(() => {
    let cancelado = false
    cargar(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los recibos.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [cargar])

  // Buscador de la ventana «Nuevo recibo»: espera a que se deje de teclear y
  // descarta las respuestas que lleguen tarde.
  const textoBusqueda = busqueda.trim()
  useEffect(() => {
    if (!emitiendo || textoBusqueda.length < 2) return
    let cancelado = false
    const temporizador = setTimeout(() => {
      setBuscando(true)
      buscarHermanosConRecibo(textoBusqueda)
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
    else await cargar().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar los recibos.'))
  }

  // Se limpia al abrir, no al cerrar, y parte del año que se está viendo.
  const anioPropuesto = year || String(new Date().getFullYear())
  const abrirCuotas = () => { setCuotas({ year: anioPropuesto, importe: '', concepto: CONCEPTO_POR_DEFECTO }); setErrorCuotas(null); setGenerando(true) }
  const abrirNuevo = (inicial: NuevoRecibo = { hermano: null, year: anioPropuesto, concepto: '', importe: '', tipo: '' }) => {
    setNuevo(inicial); setBusqueda(inicial.hermano ? nombreHermano(inicial.hermano) : ''); setCandidatos(inicial.hermano ? [inicial.hermano] : []); setErrorNuevo(null); setEmitiendo(true)
  }
  // Reemitir un devuelto es emitir uno nuevo con sus mismos datos, ya rellenos.
  // El concepto cambia: el servidor no admite dos recibos iguales para el mismo
  // hermano y año, y así se distingue el nuevo del devuelto.
  const abrirReemision = (recibo: AdminReceipt) => abrirNuevo({
    hermano: recibo.hermano,
    year: String(recibo.year),
    concepto: `${recibo.concepto} (reemisión)`.slice(0, 150),
    importe: Number(recibo.importe).toFixed(2).replace('.', ','),
    tipo: recibo.tipo && recibo.tipo !== 'PAPELETA_SITIO' ? recibo.tipo : '',
  })

  const generate = async () => {
    setWorking(true); setErrorCuotas(null); setNotice(null)
    let resultado: Awaited<ReturnType<typeof generarCuotas>>
    try { resultado = await generarCuotas({ year: Number(cuotas.year), importe: Number(cuotas.importe), concepto: cuotas.concepto }) }
    catch (err: unknown) { setErrorCuotas(err instanceof Error ? err.message : 'No se han podido generar las cuotas.'); return }
    finally { setWorking(false) }
    setGenerando(false)
    setNotice(`${resultado.message}${resultado.omitidos ? ` Omitidos: ${resultado.omitidos}.` : ''}`)
    await verAnio(cuotas.year)
  }

  const emitir = async () => {
    if (!nuevo.hermano || !nuevo.tipo) return
    setWorking(true); setErrorNuevo(null); setNotice(null)
    let resultado: Awaited<ReturnType<typeof crearRecibo>>
    try { resultado = await crearRecibo({ hermanoId: nuevo.hermano.id, year: Number(nuevo.year), concepto: nuevo.concepto.trim(), importe: leerImporte(nuevo.importe), tipo: nuevo.tipo }) }
    catch (err: unknown) { setErrorNuevo(err instanceof Error ? err.message : 'No se ha podido emitir el recibo.'); return }
    finally { setWorking(false) }
    setEmitiendo(false)
    setNotice(`${resultado.message} Queda pendiente de cobro.`)
    await verAnio(nuevo.year)
  }

  const pay = async (receipt: AdminReceipt) => {
    setWorking(true); setError(null); setNotice(null)
    // Un remesado lo cobra el banco: se da por cobrado por domiciliación, no
    // con el método de la mesa (que por defecto es efectivo).
    const metodo: PaymentMethod = receipt.estado === 'REMESADO' ? 'DOMICILIACION' : payment
    try { const resultado = await cobrarRecibo(receipt.id, metodo); setNotice(resultado.message); await cargar() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido cobrar el recibo.') }
    finally { setWorking(false) }
  }

  const abrirCambio = (recibo: AdminReceipt, destino: AdminReceiptStatus) => { setErrorCambio(null); setCambio({ recibo, destino }) }
  const cambiarEstado = async (comision?: number) => {
    if (!cambio) return
    setWorking(true); setErrorCambio(null); setNotice(null)
    try {
      const resultado = await cambiarEstadoRecibo(cambio.recibo.id, { estado: cambio.destino, ...(comision !== undefined ? { comision } : {}) })
      setCambio(null)
      setNotice(resultado.message)
      await cargar()
    } catch (err: unknown) {
      setErrorCambio(err instanceof Error ? err.message : 'No se ha podido cambiar el estado del recibo.')
    } finally { setWorking(false) }
  }

  const cuotasValidas = Boolean(cuotas.year) && Number(cuotas.importe) > 0 && Boolean(cuotas.concepto)
  const importeNuevo = leerImporte(nuevo.importe)
  const nuevoValido = nuevo.hermano !== null && esAnioCompleto(nuevo.year) && nuevo.concepto.trim() !== '' && importeNuevo > 0 && nuevo.tipo !== ''

  return <>
    <Helmet><title>Tesorería | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Tesorería">
      <Button variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => abrirNuevo()}>Nuevo recibo</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCuotas}>Generar cuotas</Button>
    </CabeceraSeccion>
    <IncidenciasDePago />
    <Tabs
      value={vista}
      onChange={(_, valor) => setParams((anteriores) => {
        const siguientes = new URLSearchParams(anteriores)
        if (valor === 'impagos' || valor === 'remesas') siguientes.set('vista', valor)
        else siguientes.delete('vista')
        return siguientes
      })}
      sx={{ mb: 3 }}
    >
      <Tab value="recibos" label="Recibos" />
      <Tab value="impagos" label="Impagos" />
      <Tab value="remesas" label="Remesas" />
    </Tabs>
    {vista === 'impagos' ? <ListaImpagos puedeDarDeBaja={puedeDarDeBaja} /> : vista === 'remesas' ? <Remesas /> : <>
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
      <Typography variant="h4" sx={{ flexGrow: 1 }}>{esAnioCompleto(year) ? `Recibos del año ${year}` : 'Recibos de todos los años'}</Typography>
      {/* No es un filtro: es con qué se cobra al pulsar «Cobrar», y así lo dice. */}
      <TextField size="small" select label="Al pulsar «Cobrar», cobrar en" value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} sx={{ minWidth: { sm: 230 } }}
        helperText="Los remesados se cobran siempre por domiciliación.">
        {methods.map((method) => <MenuItem key={method} value={method}>{NOMBRE_METODO[method] ?? method}</MenuItem>)}
      </TextField>
    </Stack>
    <BarraListado
      valores={filtros}
      onCambiar={cambiarFiltros}
      busqueda={{ clave: 'q', etiqueta: 'Buscar recibos', placeholder: 'Hermano, número de hermano o concepto' }}
      filtros={[
        { clave: 'tipo', etiqueta: 'Tipo', todos: 'Todos', opciones: TIPOS_RECIBO, ancho: 180 },
      ]}
      orden={{ clave: 'orden', opciones: ORDENES_RECIBOS }}
      anchoHijos={110}
    >
      <TextField
        size="small"
        label="Año"
        type="number"
        value={year}
        onChange={(event) => cambiarAnio(event.target.value)}
        helperText={year ? undefined : 'Vacío: todos los años'}
        sx={{ minWidth: 0 }}
      />
    </BarraListado>
    {filtros.recibo && (
      <Alert
        severity="info"
        sx={{ mb: 2 }}
        action={<Button color="inherit" size="small" onClick={() => cambiarFiltros({ recibo: '' })}>Todos los recibos</Button>}
      >
        Solo el recibo #{filtros.recibo}, al que lleva su apunte de Contabilidad.
      </Alert>
    )}
    <ContadoresEstado resumen={resumen} elegido={filtros.estado as AdminReceiptStatus | ''} onElegir={(estado) => cambiarFiltros({ estado })} />
    {loading ? <CircularProgress aria-label="Cargando recibos" /> : receipts.length === 0
      ? <Alert severity="info">{filtros.q || filtros.estado || filtros.tipo ? 'No hay recibos con esta búsqueda o estos filtros.' : filtros.recibo ? `No existe el recibo #${filtros.recibo}.` : esAnioCompleto(year) ? 'No hay recibos para este año.' : 'No hay recibos.'}</Alert>
      : <ListaRecibos recibos={receipts} verAnio={!esAnioCompleto(year)} ocupado={working} onCobrar={pay} onConfirmar={pay} onReemitir={abrirReemision} onCambiarEstado={abrirCambio} />}
    <DialogoEstado cambio={cambio} guardando={working} error={errorCambio} onConfirmar={(comision) => void cambiarEstado(comision)} onCancelar={() => setCambio(null)} />
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="recibos" />}
    </>}
  </>
}
