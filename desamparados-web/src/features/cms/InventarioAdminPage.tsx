import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import { useLocation, useSearchParams } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import {
  cambiarTotalDeCingulos, crearEnser, crearPrenda, devolverPrenda, eliminarEnser, eliminarPrenda, listarEnseres, listarPrendas, marcarLavadas,
  opcionesDeEnseres, recuentoDeCingulos, recuentoDelRopero, type Enser, type FiltrosPrendas, type Prenda, type RecuentoDeCingulos, type RecuentoDeTipo,
} from '../../lib/api/inventario'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import VentanaFormulario from './VentanaFormulario'
import { DialogoDevolucion, DialogoPrestamo } from './DialogosRopero'
import { AVISO_CANTIDADES, ESTADOS_ELEGIBLES, ETIQUETA_ESTADO, ETIQUETA_TIPO, esCantidadValida } from './ropero'
import BarraListado, { type Opcion } from './listados/BarraListado'
import { useFiltrosUrl } from './listados/useFiltrosUrl'
import TablaEnseres from './inventario/TablaEnseres'
import PrendasEnFichas from './inventario/PrendasEnFichas'
import RoperoPorGrupos from './inventario/RoperoPorGrupos'
import { useEnFichas } from './listados/useEnFichas'
import TarjetaCingulos from './inventario/TarjetaCingulos'
import { site } from '../../config/site'
import { deLaCorporacion } from '../../domain/articulos'
import { useModulos } from '../../hooks/useModulos'

const emptyEnser = { nombre: '', referencia: '', categoria: '', ubicacion: '', cantidadOptimo: '0', cantidadBueno: '0', cantidadReparar: '0' }
const emptyPrenda = { numero: '', tipo: 'TUNICA', talla: '', estado: 'DISPONIBLE', observaciones: '' }

const CAMPOS_ENSER = [['nombre', 'Nombre'], ['referencia', 'Referencia'], ['categoria', 'Categoría'], ['ubicacion', 'Ubicación']] as const
const CANTIDADES_ENSER = [['cantidadOptimo', 'Óptimo'], ['cantidadBueno', 'Bueno'], ['cantidadReparar', 'A reparar']] as const

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

const aOpciones = <K extends string>(etiquetas: Record<K, string>): Opcion[] =>
  (Object.entries(etiquetas) as [K, string][]).map(([valor, etiqueta]) => ({ valor, etiqueta }))
const valoresDe = (opciones: Opcion[]) => opciones.map((o) => o.valor)

const ORDENES_ENSERES: Opcion[] = [
  { valor: 'nombre', etiqueta: 'Nombre (A-Z)' },
  { valor: 'categoria', etiqueta: 'Categoría' },
  { valor: 'ubicacion', etiqueta: 'Ubicación' },
  { valor: 'unidades', etiqueta: 'Más unidades' },
  { valor: 'reparar', etiqueta: 'Más piezas a reparar' },
]
const ORDENES_PRENDAS: Opcion[] = [
  { valor: 'numero', etiqueta: 'Número' },
  { valor: 'tipo', etiqueta: 'Tipo' },
  { valor: 'estado', etiqueta: 'Estado' },
  { valor: 'talla', etiqueta: 'Talla' },
]
const TIPOS_PRENDA = aOpciones(ETIQUETA_TIPO)
const ESTADOS_PRENDA = aOpciones(ETIQUETA_ESTADO)
const A_REPARAR: Opcion[] = [{ valor: 'si', etiqueta: 'Con piezas a reparar' }]

// Categoría y ubicación son texto libre: sus valores válidos son los que haya en la base.
const FILTROS_ENSERES = {
  q: {},
  categoria: {},
  ubicacion: {},
  reparar: { validos: valoresDe(A_REPARAR) },
  orden: { porDefecto: 'nombre', validos: valoresDe(ORDENES_ENSERES) },
}
const FILTROS_PRENDAS = {
  q: {},
  tipo: { validos: valoresDe(TIPOS_PRENDA) },
  estado: { validos: valoresDe(ESTADOS_PRENDA) },
  orden: { porDefecto: 'numero', validos: valoresDe(ORDENES_PRENDAS) },
}

export default function InventarioAdminPage() {
  const { activo } = useModulos()
  // El ropero es de Procesión y los enseres del Inventario: la pantalla enseña lo que haya.
  const conEnseres = activo('inventario')
  const conRopero = activo('procesion')
  // La pestaña vive en la URL, como los filtros: al volver de editar una
  // prenda se vuelve al ropero, no a los enseres.
  const [params, setParams] = useSearchParams()
  const tab = !conEnseres ? 1 : !conRopero ? 0 : params.get('vista') === 'ropero' ? 1 : 0
  const titulo = conEnseres ? 'Inventario' : 'Ropero'
  const setTab = (valor: number) => setParams((anteriores) => {
    const siguientes = new URLSearchParams(anteriores)
    if (valor === 1) siguientes.set('vista', 'ropero')
    else siguientes.delete('vista')
    return siguientes
  }, { replace: true })
  const [listaEnseres, setListaEnseres] = useState<Enser[]>([])
  const [listaPrendas, setListaPrendas] = useState<Prenda[]>([])
  const [enserForm, setEnserForm] = useState(emptyEnser)
  const [prendaForm, setPrendaForm] = useState(emptyPrenda)
  // La ventana de alta abierta: la del enser o la de la prenda, según la pestaña desde la que se pidió.
  const [creando, setCreando] = useState<'enser' | 'prenda' | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  // La prenda que se está prestando o devolviendo: cada una con su diálogo.
  const [prestando, setPrestando] = useState<Prenda | null>(null)
  const [devolviendo, setDevolviendo] = useState<Prenda | null>(null)
  const [lavandoTodo, setLavandoTodo] = useState(false)
  const [cingulos, setCingulos] = useState<RecuentoDeCingulos | null>(null)
  // Cuántas hay de cada tipo en cada estado: las cabeceras de los grupos, el
  // número de la pestaña y si hay algo en el lavado.
  const [recuento, setRecuento] = useState<RecuentoDeTipo[] | null>(null)
  // Los grupos del PC piden sus prendas ellos mismos: esto les avisa de que algo cambió.
  const [recarga, setRecarga] = useState(0)
  // En el PC, el ropero por grupos; en el móvil, la lista en fichas, paginada como siempre.
  const enFichas = useEnFichas()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [porBorrar, setPorBorrar] = useState<Enser | Prenda | null>(null)
  // La consulta actual viaja con el enlace de editar (página, tamaño y filtros):
  // así la pantalla de edición sabe a qué página del listado devolver.
  const { search: consultaListado } = useLocation()
  // Dos listados independientes en la misma pantalla, cada uno con su
  // paginación: con un parámetro compartido, pasar de página en los enseres
  // movería también el ropero. El prefijo separa ?paginaEnseres= de ?paginaPrendas=.
  const enseres = usePaginacion('Enseres')
  const prendas = usePaginacion('Prendas')
  const [metaEnseres, setMetaEnseres] = useState<MetaPaginacion | null>(null)
  const [metaPrendas, setMetaPrendas] = useState<MetaPaginacion | null>(null)
  // Cada listado con sus filtros, con el mismo prefijo que su paginación.
  const [filtrosEnseres, cambiarEnseres] = useFiltrosUrl(FILTROS_ENSERES, 'Enseres')
  const [filtrosPrendas, cambiarPrendas] = useFiltrosUrl(FILTROS_PRENDAS, 'Prendas')
  const [opciones, setOpciones] = useState<{ categorias: string[]; ubicaciones: string[] }>({ categorias: [], ubicaciones: [] })

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en cualquiera de los dos paginadores lanzan dos cargas que
  // pueden resolverse en orden inverso y dejar en pantalla los datos de una
  // página con la URL diciendo otra. Solo la última carga en marcha tiene
  // derecho a escribir. Las llamadas de después de crear, borrar, asignar o
  // devolver la omiten: no hay carrera.
  // Un módulo apagado no tiene router (404 MODULO_NO_ACTIVADO): sin su
  // pestaña en pantalla, tampoco se le pide nada.
  const cargar = useCallback((vigente: () => boolean = () => true) => Promise.all([
    conEnseres ? listarEnseres({ pagina: enseres.pagina, porPagina: enseres.porPagina }, {
      search: filtrosEnseres.q,
      categoria: filtrosEnseres.categoria,
      ubicacion: filtrosEnseres.ubicacion,
      necesitaReparacion: filtrosEnseres.reparar ? 'true' : '',
      orden: filtrosEnseres.orden,
    }) : null,
    conRopero && enFichas ? listarPrendas({ pagina: prendas.pagina, porPagina: prendas.porPagina }, filtrosPrendas as FiltrosPrendas) : null,
    // Sin el recuento de cíngulos o el del ropero, las prendas se siguen viendo.
    conRopero ? recuentoDeCingulos().catch(() => null) : null,
    conRopero ? recuentoDelRopero().catch(() => null) : null,
  ]).then(([a, b, c, d]) => {
    if (!vigente()) return
    if (a) { setListaEnseres(a.data); setMetaEnseres(a.meta) }
    if (b) { setListaPrendas(b.data); setMetaPrendas(b.meta) }
    if (conRopero) { setCingulos(c); setRecuento(Array.isArray(d) ? d : []) }
  }), [conEnseres, conRopero, enFichas, enseres.pagina, enseres.porPagina, prendas.pagina, prendas.porPagina, filtrosEnseres, filtrosPrendas])

  /** Tras cambiar algo: el listado, los recuentos y los grupos del PC. */
  const recargar = () => {
    setRecarga((n) => n + 1)
    return cargar()
  }

  // Las categorías y ubicaciones en uso, para los desplegables. Si fallan, los
  // filtros se quedan sin opciones pero el listado se sigue viendo.
  const cargarOpciones = useCallback(() => opcionesDeEnseres()
    .then((o) => setOpciones({ categorias: o.categorias ?? [], ubicaciones: o.ubicaciones ?? [] }))
    .catch(() => undefined), [])
  useEffect(() => {
    if (!conEnseres) return
    void cargarOpciones()
  }, [conEnseres, cargarOpciones])

  useEffect(() => {
    let cancelado = false
    cargar(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar el inventario.')) })
    return () => { cancelado = true }
  }, [cargar])

  // Cada ventana se limpia al abrirse, no al cerrarse: así no se vacía a la vista mientras se va.
  const abrirAlta = () => {
    if (tab === 0) setEnserForm(emptyEnser)
    else setPrendaForm(emptyPrenda)
    setErrorAlta(null)
    setCreando(tab === 0 ? 'enser' : 'prenda')
  }

  /** Guarda lo de la ventana abierta; si falla, la ventana sigue abierta con el motivo. */
  const guardar = async (peticion: () => Promise<unknown>, aviso: string, porDefecto: string) => {
    setGuardando(true); setErrorAlta(null); setNotice(null)
    try { await peticion() }
    catch (e: unknown) { setErrorAlta(mensaje(e, porDefecto)); return }
    finally { setGuardando(false) }
    setCreando(null)
    setNotice(aviso)
    await recargar().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar el inventario.')))
  }

  // Un enser nuevo puede traer una categoría o una ubicación que aún no estaba en los filtros.
  const saveEnser = async () => {
    await guardar(
      () => crearEnser({ ...enserForm, cantidadOptimo: Number(enserForm.cantidadOptimo), cantidadBueno: Number(enserForm.cantidadBueno), cantidadReparar: Number(enserForm.cantidadReparar) }),
      'Enser creado correctamente.',
      'No se ha podido guardar el enser.',
    )
    await cargarOpciones()
  }
  const savePrenda = () => guardar(() => crearPrenda(prendaForm), 'Prenda creada correctamente.', 'No se ha podido guardar la prenda.')
  const nombreDe = (item: Enser | Prenda) => ('nombre' in item ? item.nombre : `Prenda ${item.numero}`)
  const borrar = async () => { if (!porBorrar) return; try { if (tab === 0) await eliminarEnser(porBorrar.id); else await eliminarPrenda(porBorrar.id); await recargar(); setNotice('Elemento eliminado correctamente.') } catch (e: unknown) { setError(mensaje(e, 'No se ha podido eliminar el elemento.')) } finally { setPorBorrar(null) } }
  const cantidadesValidas = CANTIDADES_ENSER.every(([campo]) => esCantidadValida(enserForm[campo]))
  const prestada = async (aviso: string) => {
    setPrestando(null)
    setError(null)
    setNotice(aviso)
    await recargar().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar el inventario.')))
  }
  const devolver = async (rota: boolean) => {
    const prenda = devolviendo
    setDevolviendo(null)
    if (!prenda) return
    try {
      const { data } = await devolverPrenda(prenda.id, rota)
      await recargar()
      setNotice(`Prenda ${prenda.numero} devuelta: ${data.estado === 'TALLER' ? 'al taller, para arreglarla' : data.estado === 'LAVADO' ? 'al lavado' : 'queda disponible'}.`)
    } catch (e: unknown) { setError(mensaje(e, 'No se ha podido registrar la devolución.')) }
  }
  const lavadas = async (prenda?: Prenda) => {
    setLavandoTodo(false)
    try {
      const r = await marcarLavadas(prenda && [prenda.id])
      await recargar()
      setNotice(prenda ? `Prenda ${prenda.numero} lavada: queda disponible.` : r.lavadas === 0 ? 'No había nada en el lavado.' : `${r.lavadas} ${r.lavadas === 1 ? 'prenda lavada queda disponible' : 'prendas lavadas quedan disponibles'}.`)
    } catch (e: unknown) { setError(mensaje(e, 'No se han podido marcar como lavadas.')) }
  }
  const guardarCingulos = async (total: number) => {
    setCingulos(await cambiarTotalDeCingulos(total))
    setNotice(`Cíngulos ${deLaCorporacion({ corto: true })}: ${total}.`)
  }

  const totalRopero = recuento ? recuento.reduce((suma, r) => suma + r.total, 0) : null
  const enLavado = recuento ? recuento.reduce((suma, r) => suma + (r.estados.LAVADO ?? 0), 0) : 0
  const accionesPrenda = { onPrestar: setPrestando, onDevolver: setDevolviendo, onLavada: (p: Prenda) => void lavadas(p), onBorrar: setPorBorrar }

  return <>
    <Helmet><title>{`${titulo} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    {/* Título solo y, debajo, en una fila: el interruptor a la izquierda y los
        botones a la derecha, a la misma altura. Con el interruptor en el hueco
        del subtítulo, los botones quedaban centrados entre los dos, descolgados. */}
    <Typography variant="h2" component="h1" sx={{ mb: 2 }}>{titulo}</Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
      {conEnseres && conRopero && (
        // Un interruptor con lo que hay en cada lado. El número no entra en el
        // nombre de la pestaña: se anuncia «Ropero», no «Ropero 126».
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          aria-label="Qué ver"
          sx={{
            minHeight: 0, display: 'inline-flex', p: 0.5, borderRadius: 999, backgroundColor: 'action.hover',
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': { minHeight: 40, px: 2.25, borderRadius: 999, textTransform: 'none', fontSize: 15, fontWeight: 600, color: 'text.secondary' },
            '& .MuiTab-root.Mui-selected': { backgroundColor: 'text.primary', color: 'background.paper' },
          }}
        >
          <Tab label={<span>Enseres{metaEnseres && <Box component="span" aria-hidden="true" sx={{ opacity: 0.7, fontWeight: 500, ml: 0.75 }}>{metaEnseres.total}</Box>}</span>} />
          <Tab label={<span>Ropero{totalRopero !== null && <Box component="span" aria-hidden="true" sx={{ opacity: 0.7, fontWeight: 500, ml: 0.75 }}>{totalRopero}</Box>}</span>} />
        </Tabs>
      )}
      <Box sx={{ flex: 1 }} />
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' }, '& > *': { flex: { xs: '1 1 auto', sm: 'none' } }, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
        {tab === 1 && enLavado > 0 && (
          <Button variant="outlined" color="inherit" onClick={() => setLavandoTodo(true)} sx={{ textTransform: 'none', borderColor: 'divider' }}>Todo el lavado, limpio</Button>
        )}
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirAlta}>{tab === 0 ? 'Nuevo enser' : 'Nueva prenda'}</Button>
      </Box>
    </Box>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    <DialogoPrestamo key={prestando?.id ?? 'cerrado'} prenda={prestando} onCerrar={() => setPrestando(null)} onPrestada={(aviso) => void prestada(aviso)} />
    <DialogoDevolucion prenda={devolviendo} onElegir={(rota) => void devolver(rota)} onCancelar={() => setDevolviendo(null)} />
    <DialogoConfirmacion abierto={lavandoTodo} titulo="¿Todo el lavado, limpio?" mensaje="Todas las prendas que constan en el lavado pasan a estar disponibles para prestarlas." textoConfirmar="Sí, todo limpio" onConfirmar={() => void lavadas()} onCancelar={() => setLavandoTodo(false)} />
    <DialogoConfirmacion abierto={porBorrar !== null} titulo={tab === 0 ? '¿Eliminar el enser?' : '¿Eliminar la prenda?'} mensaje={porBorrar ? nombreDe(porBorrar) : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} />

    <VentanaFormulario
      abierto={creando === 'enser'}
      titulo="Nuevo enser"
      sucio={JSON.stringify(enserForm) !== JSON.stringify(emptyEnser)}
      guardando={guardando}
      puedeGuardar={Boolean(enserForm.nombre) && cantidadesValidas}
      error={errorAlta}
      onGuardar={saveEnser}
      onCerrar={() => setCreando(null)}
    >
      {CAMPOS_ENSER.map(([campo, etiqueta]) => <TextField key={campo} label={etiqueta} value={enserForm[campo]} onChange={(e) => setEnserForm({ ...enserForm, [campo]: e.target.value })} fullWidth />)}
      <Typography variant="subtitle2">Unidades por estado</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {CANTIDADES_ENSER.map(([campo, etiqueta]) => <TextField key={campo} label={etiqueta} type="number" slotProps={{ htmlInput: { min: 0, step: 1, inputMode: 'numeric' } }} value={enserForm[campo]} onChange={(e) => setEnserForm({ ...enserForm, [campo]: e.target.value })} error={!esCantidadValida(enserForm[campo])} fullWidth />)}
      </Stack>
      {!cantidadesValidas && <Alert severity="warning">{AVISO_CANTIDADES}</Alert>}
    </VentanaFormulario>

    <VentanaFormulario
      abierto={creando === 'prenda'}
      titulo="Nueva prenda"
      sucio={JSON.stringify(prendaForm) !== JSON.stringify(emptyPrenda)}
      guardando={guardando}
      puedeGuardar={Boolean(prendaForm.numero)}
      error={errorAlta}
      onGuardar={savePrenda}
      onCerrar={() => setCreando(null)}
    >
      <TextField label="Número" value={prendaForm.numero} onChange={(e) => setPrendaForm({ ...prendaForm, numero: e.target.value })} fullWidth />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField select label="Tipo de prenda" value={prendaForm.tipo} onChange={(e) => setPrendaForm({ ...prendaForm, tipo: e.target.value })} fullWidth>{TIPOS_PRENDA.map((t) => <MenuItem key={t.valor} value={t.valor}>{t.etiqueta}</MenuItem>)}</TextField>
        <TextField label="Talla" value={prendaForm.talla} onChange={(e) => setPrendaForm({ ...prendaForm, talla: e.target.value })} fullWidth />
      </Stack>
      {/* Sin «Prestada»: una prenda se presta con «Prestar», que anota a quién. */}
      <TextField select label="Estado" value={prendaForm.estado} onChange={(e) => setPrendaForm({ ...prendaForm, estado: e.target.value })} helperText="Para prestarla, usa «Prestar» en el listado del ropero." fullWidth>{ESTADOS_ELEGIBLES.map((v) => <MenuItem key={v} value={v}>{ETIQUETA_ESTADO[v]}</MenuItem>)}</TextField>
      <TextField label="Observaciones" value={prendaForm.observaciones} onChange={(e) => setPrendaForm({ ...prendaForm, observaciones: e.target.value })} fullWidth multiline />
    </VentanaFormulario>

    {tab === 0 ? (
      <BarraListado
        valores={filtrosEnseres}
        onCambiar={cambiarEnseres}
        busqueda={{ clave: 'q', etiqueta: 'Buscar enseres', placeholder: 'Nombre, referencia, categoría o ubicación' }}
        filtros={[
          { clave: 'categoria', etiqueta: 'Categoría', todos: 'Todas', opciones: opciones.categorias.map((c) => ({ valor: c, etiqueta: c })) },
          { clave: 'ubicacion', etiqueta: 'Ubicación', todos: 'Todas', opciones: opciones.ubicaciones.map((u) => ({ valor: u, etiqueta: u })) },
          { clave: 'reparar', etiqueta: 'Conservación', todos: 'Todos', opciones: A_REPARAR, ancho: 190 },
        ]}
        orden={{ clave: 'orden', opciones: ORDENES_ENSERES }}
      />
    ) : (<>
      <TarjetaCingulos recuento={cingulos} onGuardar={guardarCingulos} />
      <BarraListado
        valores={filtrosPrendas}
        onCambiar={cambiarPrendas}
        busqueda={{ clave: 'q', etiqueta: 'Buscar en el ropero', placeholder: 'Número, talla, observaciones o hermano' }}
        filtros={[
          { clave: 'tipo', etiqueta: 'Tipo', todos: 'Todos', opciones: TIPOS_PRENDA },
          { clave: 'estado', etiqueta: 'Estado', todos: 'Todos', opciones: ESTADOS_PRENDA },
        ]}
        orden={{ clave: 'orden', opciones: ORDENES_PRENDAS }}
      />
    </>)}
    {/* Hasta que llega la primera página no se pinta la tabla: vacía, diría «No hay enseres» mientras carga. */}
    {tab === 0
      ? metaEnseres && <TablaEnseres enseres={listaEnseres} volver={consultaListado} onBorrar={setPorBorrar} />
      : enFichas
        ? metaPrendas && <PrendasEnFichas prendas={listaPrendas} volver={consultaListado} {...accionesPrenda} />
        : <RoperoPorGrupos recuento={recuento} filtros={filtrosPrendas as FiltrosPrendas} volver={consultaListado} recarga={recarga} {...accionesPrenda} />}
    {tab === 0
      ? metaEnseres && <Paginador meta={metaEnseres} onPagina={enseres.irAPagina} onTamano={enseres.cambiarTamano} etiqueta="los enseres" />
      : enFichas && metaPrendas && <Paginador meta={metaPrendas} onPagina={prendas.irAPagina} onTamano={prendas.cambiarTamano} etiqueta="las prendas del ropero" />}
  </>
}
