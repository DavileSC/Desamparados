import { useCallback, useEffect, useState } from 'react'
import { Alert, Autocomplete, Box, Button, CircularProgress, Menu, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../altas/auth/store'
import { useModulos } from '../../hooks/useModulos'
import { useAhora } from '../../hooks/useAhora'
import ListaImpagos from './impagos/ListaImpagos'
import { Helmet } from 'react-helmet-async'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import {
  crearRecibo,
  darPorPerdida,
  esAnioCompleto,
  generarCuotas,
  recibosDelCms,
  resumenDeRecibos,
  cobrarRecibo,
  cambiarEstadoRecibo,
  buscarHermanosConRecibo,
  type AdminReceipt,
  type AdminReceiptStatus,
  type DatosDevolucion,
  type EmittableReceiptType,
  type FiltrosRecibos,
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
import DialogoEstado, { type CambioEstado } from './tesoreria/DialogoEstado'
import IncidenciasDePago from './tesoreria/IncidenciasDePago'
import Modelo182 from './tesoreria/Modelo182'
import Remesas from './tesoreria/Remesas'
import PanelResumen, { type Destino } from './tesoreria/PanelResumen'
import VentanaCobro from './tesoreria/VentanaCobro'
import FichaRecibo from './tesoreria/FichaRecibo'
import { euros } from './contabilidad/formato'
import { site } from '../../config/site'
import { ErrorDeApi } from '../../lib/api/cliente'

const statusLabels: Record<AdminReceipt['estado'], string> = { PENDIENTE: 'Pendiente', REMESADO: 'Remesado', PAGADO: 'Pagado', ANULADO: 'Anulado', DEVUELTO: 'Devuelto', EXENTO: 'Exento', REEMBOLSADO: 'Reembolsado' }
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
// `reemisionDe`: el devuelto que se vuelve a cobrar, si se llegó por «Reemitir».
interface NuevoRecibo { hermano: ReceiptBrother | null; year: string; concepto: string; importe: string; tipo: EmittableReceiptType | ''; reemisionDe?: number }

export default function TesoreriaAdminPage() {
  const { activo } = useModulos()
  const anioActual = useAhora().getFullYear()
  const conRemesas = activo('remesas')
  const conModelo182 = activo('modelo-182')
  const [params, setParams] = useSearchParams()
  const vistaPedida = params.get('vista')
  // Sin vista, el resumen, que es la entrada; pero un enlace con filtros de
  // recibos (desde Contabilidad, o uno guardado) va a los recibos. Una vista de
  // un módulo apagado cae en Recibos.
  const conFiltros = ['q', 'estado', 'tipo', 'orden', 'recibo', 'anio', 'pagina'].some((clave) => params.has(clave))
  const vista = vistaPedida === 'resumen' || vistaPedida === 'impagos' || vistaPedida === 'recibos' || (vistaPedida === 'remesas' && conRemesas) || (vistaPedida === 'modelo182' && conModelo182)
    ? vistaPedida
    : vistaPedida === null && !conFiltros ? 'resumen' : 'recibos'
  // Llegado a los recibos por los filtros, la vista se escribe en la dirección:
  // si no, al quitar el último filtro (cambiar de año vuelve a la página 1 y
  // borra «pagina») se saltaría al resumen sin haberlo pedido.
  useEffect(() => {
    if (vista === 'recibos' && vistaPedida === null) {
      setParams((anteriores) => { const siguientes = new URLSearchParams(anteriores); siguientes.set('vista', 'recibos'); return siguientes }, { replace: true })
    }
  }, [vista, vistaPedida, setParams])
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
  // Los elegidos para cobrar a la vez, con sus datos: siguen elegidos al pasar de página.
  const [elegidos, setElegidos] = useState<Map<number, AdminReceipt>>(new Map())
  const [ficha, setFicha] = useState<AdminReceipt | null>(null)
  const [cobro, setCobro] = useState<{ abierto: boolean; recibos: AdminReceipt[] }>({ abierto: false, recibos: [] })
  const [menuMas, setMenuMas] = useState<HTMLElement | null>(null)
  // Dar por perdida una papeleta devuelta: lo decide el Hermano Mayor.
  const [perdida, setPerdida] = useState<AdminReceipt | null>(null)
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [errorPerdida, setErrorPerdida] = useState<string | null>(null)
  const [cambio, setCambio] = useState<CambioEstado | null>(null)
  // `delDia`: el servidor rechazó el día de la devolución (de mañana, o de antes
  // del cobro); se enseña junto a ese campo, que es lo que hay que cambiar.
  const [errorCambio, setErrorCambio] = useState<{ texto: string; delDia: boolean } | null>(null)
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
  const anioPropuesto = () => year || String(new Date().getFullYear())
  const abrirCuotas = () => { setCuotas({ year: anioPropuesto(), importe: '', concepto: CONCEPTO_POR_DEFECTO }); setErrorCuotas(null); setGenerando(true) }
  const abrirNuevo = (inicial: NuevoRecibo = { hermano: null, year: anioPropuesto(), concepto: '', importe: '', tipo: '' }) => {
    setNuevo(inicial); setBusqueda(inicial.hermano ? nombreHermano(inicial.hermano) : ''); setCandidatos(inicial.hermano ? [inicial.hermano] : []); setErrorNuevo(null); setEmitiendo(true)
  }
  // Reemitir un devuelto es emitir uno nuevo con sus mismos datos, ya rellenos.
  // El concepto cambia: el servidor no admite dos recibos iguales para el mismo
  // hermano y año, y así se distingue el nuevo del devuelto. Va enlazado al
  // devuelto: sin el enlace, un donativo reemitido no lo tapaba y seguía
  // contando como deuda.
  const abrirReemision = (recibo: AdminReceipt) => abrirNuevo({
    reemisionDe: recibo.id,
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
    try { resultado = await crearRecibo({ hermanoId: nuevo.hermano.id, year: Number(nuevo.year), concepto: nuevo.concepto.trim(), importe: leerImporte(nuevo.importe), tipo: nuevo.tipo, ...(nuevo.reemisionDe !== undefined ? { reemisionDeId: nuevo.reemisionDe } : {}) }) }
    catch (err: unknown) { setErrorNuevo(err instanceof Error ? err.message : 'No se ha podido emitir el recibo.'); return }
    finally { setWorking(false) }
    setEmitiendo(false)
    setNotice(`${resultado.message} Queda pendiente de cobro.`)
    await verAnio(nuevo.year)
  }

  // Cobrar abre «Registrar cobro», donde se elige cómo se paga y qué día.
  const abrirCobro = (recibos: AdminReceipt[]) => { setFicha(null); setCobro({ abierto: true, recibos }) }
  const cobrado = async (mensaje: string) => {
    setCobro({ abierto: false, recibos: [] }); setElegidos(new Map()); setNotice(mensaje); setError(null)
    await cargar().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar los recibos.'))
  }
  // Un remesado lo cobra el banco: se confirma por domiciliación, sin ventana.
  const confirmar = async (receipt: AdminReceipt) => {
    setWorking(true); setError(null); setNotice(null); setFicha(null)
    try { const resultado = await cobrarRecibo(receipt.id, 'DOMICILIACION'); setNotice(resultado.message); await cargar() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido cobrar el recibo.') }
    finally { setWorking(false) }
  }
  const elegir = (recibos: AdminReceipt[], si: boolean) => setElegidos((antes) => {
    const nuevos = new Map(antes)
    for (const r of recibos) { if (si) nuevos.set(r.id, r); else nuevos.delete(r.id) }
    return nuevos
  })
  const totalElegido = [...elegidos.values()].reduce((s, r) => s + Number(r.importe), 0)

  const cambiarVista = (valor: string, estado?: AdminReceiptStatus) => setParams((anteriores) => {
    const siguientes = new URLSearchParams(anteriores)
    // «resumen» va escrito: sin él, los filtros de los recibos que siguen en la
    // dirección (el estado elegido en una cifra) llevarían otra vez a los recibos.
    siguientes.set('vista', valor)
    if (estado) { siguientes.set('estado', estado); siguientes.delete('pagina') }
    return siguientes
  })
  const ir = (destino: Destino) => cambiarVista(destino.vista, destino.vista === 'recibos' ? destino.estado : undefined)

  const abrirPerdida = (recibo: AdminReceipt) => { setFicha(null); setMotivoPerdida(''); setErrorPerdida(null); setPerdida(recibo) }
  const confirmarPerdida = async () => {
    if (!perdida) return
    setWorking(true); setErrorPerdida(null); setNotice(null)
    try {
      const r = await darPorPerdida(perdida.id, motivoPerdida.trim() || undefined)
      setPerdida(null); setNotice(r.message)
      await cargar()
    } catch (err: unknown) {
      setErrorPerdida(err instanceof Error ? err.message : 'No se ha podido dar por perdida.')
    } finally { setWorking(false) }
  }

  const abrirCambio = (recibo: AdminReceipt, destino: AdminReceiptStatus) => { setFicha(null); setErrorCambio(null); setCambio({ recibo, destino }) }
  const cambiarEstado = async (devolucion: DatosDevolucion) => {
    if (!cambio) return
    setWorking(true); setErrorCambio(null); setNotice(null)
    try {
      const resultado = await cambiarEstadoRecibo(cambio.recibo.id, { estado: cambio.destino, ...devolucion })
      setCambio(null)
      setNotice(resultado.message)
      await cargar()
    } catch (err: unknown) {
      // Un 400 sin campos al devolver solo puede ser por el día: la comisión
      // mal escrita llega con su campo.
      const delDia = cambio.destino === 'DEVUELTO' && err instanceof ErrorDeApi && err.status === 400 && Object.keys(err.fields).length === 0
      setErrorCambio({ texto: err instanceof Error ? err.message : 'No se ha podido cambiar el estado del recibo.', delDia })
    } finally { setWorking(false) }
  }

  // El resumen es de un ejercicio: con «todos los años» en los recibos, el de hoy.
  const anioDelResumen = esAnioCompleto(year) ? year : String(anioActual)
  const cuotasValidas = Boolean(cuotas.year) && Number(cuotas.importe) > 0 && Boolean(cuotas.concepto)
  const importeNuevo = leerImporte(nuevo.importe)
  const nuevoValido = nuevo.hermano !== null && esAnioCompleto(nuevo.year) && nuevo.concepto.trim() !== '' && importeNuevo > 0 && nuevo.tipo !== ''

  return <>
    <Helmet><title>{`Tesorería | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    {/* Lo que más se hace, a la vista: cobrar. Generar las cuotas, una vez al año, en «Más». */}
    <CabeceraSeccion titulo="Tesorería">
      <Button onClick={(e) => setMenuMas(e.currentTarget)} endIcon={<KeyboardArrowDownIcon />} aria-haspopup="menu" aria-expanded={menuMas !== null}>Más</Button>
      <Menu anchorEl={menuMas} open={menuMas !== null} onClose={() => setMenuMas(null)}>
        <MenuItem onClick={() => { setMenuMas(null); abrirCuotas() }}>Generar cuotas</MenuItem>
      </Menu>
      <Button variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => abrirNuevo()}>Nuevo recibo</Button>
      <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={() => abrirCobro([])}>Registrar cobro</Button>
    </CabeceraSeccion>
    <IncidenciasDePago />
    <Tabs value={vista} onChange={(_, valor: string) => cambiarVista(valor)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 3 }}>
      <Tab value="resumen" label="Resumen" />
      <Tab value="recibos" label="Recibos" />
      {conRemesas && <Tab value="remesas" label="Remesas" />}
      <Tab value="impagos" label="Impagos" />
      {conModelo182 && <Tab value="modelo182" label="Modelo 182" />}
    </Tabs>
    {notice && vista !== 'recibos' && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice}</Alert>}
    {vista === 'resumen' ? <>
      <TextField select size="small" label="Ejercicio" value={anioDelResumen} onChange={(e) => cambiarAnio(e.target.value)} sx={{ mb: 2.5, minWidth: 160 }}>
        {Array.from({ length: 7 }, (_, i) => String(anioActual + 1 - i)).map((anio) => <MenuItem key={anio} value={anio}>{anio}</MenuItem>)}
      </TextField>
      <PanelResumen key={notice ?? ''} year={anioDelResumen} conRemesas={conRemesas} conModelo182={conModelo182} onIr={ir} />
    </> : vista === 'impagos' ? <ListaImpagos puedeDarDeBaja={puedeDarDeBaja} /> : vista === 'remesas' ? <Remesas /> : vista === 'modelo182' ? <Modelo182 puedeCambiar={role === 'ADMIN' || role === 'TESORERIA'} /> : <>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice}</Alert>}
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
      {nuevo.reemisionDe !== undefined && (
        <Alert severity="info">Reemite el recibo #{nuevo.reemisionDe}, que el banco devolvió: al emitirlo, ese deja de contar como pendiente. Tienen que coincidir el hermano, el año y el tipo.</Alert>
      )}
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
      : <>
        {elegidos.size > 0 && (
          <Box role="region" aria-label="Recibos elegidos" sx={{ position: 'sticky', top: 8, zIndex: 2, mb: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'secondary.main', boxShadow: 6 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>
              {elegidos.size === 1 ? '1 recibo elegido' : `${elegidos.size} recibos elegidos`} · {euros(totalElegido)}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setElegidos(new Map())}>Quitar la selección</Button>
            <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} disabled={working} onClick={() => abrirCobro([...elegidos.values()])}>
              Registrar cobro
            </Button>
          </Box>
        )}
        <ListaRecibos recibos={receipts} verAnio={!esAnioCompleto(year)} ocupado={working} onCobrar={(r) => abrirCobro([r])} onConfirmar={(r) => void confirmar(r)} onReemitir={abrirReemision} onCambiarEstado={abrirCambio}
          elegidos={new Set(elegidos.keys())} onElegir={elegir} onAbrir={setFicha} onDarPorPerdida={puedeDarDeBaja ? abrirPerdida : undefined} />
      </>}
    <DialogoEstado cambio={cambio} guardando={working} error={errorCambio?.delDia ? null : errorCambio?.texto ?? null} errorDelDia={errorCambio?.delDia ? errorCambio.texto : null} onConfirmar={(devolucion) => void cambiarEstado(devolucion)} onCancelar={() => setCambio(null)} />
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="recibos" />}
    </>}
    <FichaRecibo recibo={ficha} ocupado={working} onCerrar={() => setFicha(null)} onCobrar={abrirCobro} onConfirmar={(r) => void confirmar(r)}
      onReemitir={(r) => { setFicha(null); abrirReemision(r) }} onCambiarEstado={abrirCambio} onDarPorPerdida={puedeDarDeBaja ? abrirPerdida : undefined} />
    <VentanaFormulario
      abierto={perdida !== null}
      titulo="Darla por perdida"
      textoGuardar="Darla por perdida"
      sucio={Boolean(motivoPerdida.trim())}
      guardando={working}
      puedeGuardar
      error={errorPerdida}
      onGuardar={confirmarPerdida}
      onCerrar={() => setPerdida(null)}
    >
      {perdida && (
        <Typography variant="body2" color="text.secondary">
          {perdida.concepto} de {perdida.hermano.nombre} {perdida.hermano.apellidos}, {euros(Number(perdida.importe))}. El banco la devolvió y no se va a cobrar:
          deja de pedirse y queda anotado que lo decidió el Hermano Mayor. En Contabilidad no cambia nada, porque el ingreso ya se anuló al devolverse. No se puede deshacer.
        </Typography>
      )}
      <TextField label="Motivo (opcional)" value={motivoPerdida} onChange={(e) => setMotivoPerdida(e.target.value.replace(/[<>]/g, ''))}
        placeholder="Por ejemplo, se dio de baja" slotProps={{ htmlInput: { maxLength: 300 } }} fullWidth />
    </VentanaFormulario>
    <VentanaCobro abierto={cobro.abierto} recibos={cobro.recibos} onCerrar={() => setCobro({ abierto: false, recibos: [] })} onCobrado={(mensaje) => void cobrado(mensaje)} />
  </>
}
