import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import { crearEnser, crearPrenda, eliminarEnser, eliminarPrenda, listarEnseres, opcionesDeEnseres, listarPrendas, devolverPrenda, type Enser, type FiltrosPrendas, type Prenda } from '../../lib/api/inventario'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import { DialogoDevolucion, DialogoPrestamo } from './DialogosRopero'
import { AVISO_CANTIDADES, ESTADOS_ELEGIBLES, ETIQUETA_ESTADO, ETIQUETA_TIPO, esCantidadValida } from './ropero'
import BarraListado, { type Opcion } from './listados/BarraListado'
import { useFiltrosUrl } from './listados/useFiltrosUrl'

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
  // La pestaña vive en la URL, como los filtros: al volver de editar una
  // prenda se vuelve al ropero, no a los enseres.
  const [params, setParams] = useSearchParams()
  const tab = params.get('vista') === 'ropero' ? 1 : 0
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
  const cargar = useCallback((vigente: () => boolean = () => true) => Promise.all([
    listarEnseres({ pagina: enseres.pagina, porPagina: enseres.porPagina }, {
      search: filtrosEnseres.q,
      categoria: filtrosEnseres.categoria,
      ubicacion: filtrosEnseres.ubicacion,
      necesitaReparacion: filtrosEnseres.reparar ? 'true' : '',
      orden: filtrosEnseres.orden,
    }),
    listarPrendas({ pagina: prendas.pagina, porPagina: prendas.porPagina }, filtrosPrendas as FiltrosPrendas),
  ]).then(([a, b]) => { if (!vigente()) return; setListaEnseres(a.data); setMetaEnseres(a.meta); setListaPrendas(b.data); setMetaPrendas(b.meta) }), [enseres.pagina, enseres.porPagina, prendas.pagina, prendas.porPagina, filtrosEnseres, filtrosPrendas])

  // Las categorías y ubicaciones en uso, para los desplegables. Si fallan, los
  // filtros se quedan sin opciones pero el listado se sigue viendo.
  const cargarOpciones = useCallback(() => opcionesDeEnseres()
    .then((o) => setOpciones({ categorias: o.categorias ?? [], ubicaciones: o.ubicaciones ?? [] }))
    .catch(() => undefined), [])
  useEffect(() => { void cargarOpciones() }, [cargarOpciones])

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
    await cargar().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar el inventario.')))
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
  const borrar = async () => { if (!porBorrar) return; try { if (tab === 0) await eliminarEnser(porBorrar.id); else await eliminarPrenda(porBorrar.id); await cargar(); setNotice('Elemento eliminado correctamente.') } catch (e: unknown) { setError(mensaje(e, 'No se ha podido eliminar el elemento.')) } finally { setPorBorrar(null) } }
  const cantidadesValidas = CANTIDADES_ENSER.every(([campo]) => esCantidadValida(enserForm[campo]))
  const prestada = async (aviso: string) => {
    setPrestando(null)
    setError(null)
    setNotice(aviso)
    await cargar().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar el inventario.')))
  }
  const devolver = async (necesitaLavado: boolean) => {
    const prenda = devolviendo
    setDevolviendo(null)
    if (!prenda) return
    try {
      await devolverPrenda(prenda.id, necesitaLavado)
      await cargar()
      setNotice(necesitaLavado ? `Prenda ${prenda.numero} devuelta: pasa al taller.` : `Prenda ${prenda.numero} devuelta: queda disponible.`)
    } catch (e: unknown) { setError(mensaje(e, 'No se ha podido registrar la devolución.')) }
  }

  return <>
    <Helmet><title>Inventario | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Inventario">
      <Button variant="contained" startIcon={<AddIcon />} onClick={abrirAlta}>{tab === 0 ? 'Nuevo enser' : 'Nueva prenda'}</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    <DialogoPrestamo key={prestando?.id ?? 'cerrado'} prenda={prestando} onCerrar={() => setPrestando(null)} onPrestada={(aviso) => void prestada(aviso)} />
    <DialogoDevolucion prenda={devolviendo} onElegir={(necesitaLavado) => void devolver(necesitaLavado)} onCancelar={() => setDevolviendo(null)} />
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
        <TextField select label="Tipo de prenda" value={prendaForm.tipo} onChange={(e) => setPrendaForm({ ...prendaForm, tipo: e.target.value })} fullWidth>{['TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField>
        <TextField label="Talla" value={prendaForm.talla} onChange={(e) => setPrendaForm({ ...prendaForm, talla: e.target.value })} fullWidth />
      </Stack>
      {/* Sin «Prestada»: una prenda se presta con «Prestar», que anota a quién. */}
      <TextField select label="Estado" value={prendaForm.estado} onChange={(e) => setPrendaForm({ ...prendaForm, estado: e.target.value })} helperText="Para prestarla, usa «Prestar» en el listado del ropero." fullWidth>{ESTADOS_ELEGIBLES.map((v) => <MenuItem key={v} value={v}>{ETIQUETA_ESTADO[v]}</MenuItem>)}</TextField>
      <TextField label="Observaciones" value={prendaForm.observaciones} onChange={(e) => setPrendaForm({ ...prendaForm, observaciones: e.target.value })} fullWidth multiline />
    </VentanaFormulario>

    <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}><Tab label="Enseres" /><Tab label="Ropero" /></Tabs>
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
    ) : (
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
    )}
    <Stack spacing={2}>{tab === 0 ? listaEnseres.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Typography>{item.nombre} · {item.cantidadTotal} unidades{item.cantidadReparar > 0 ? ` (${item.cantidadReparar} a reparar)` : ''} · {item.ubicacion || 'Sin ubicación'}</Typography><Stack direction="row"><Button aria-label={`Editar ${item.nombre}`} component={Link} to={`/cms/inventario/${item.id}/editar`} state={{ volver: consultaListado }}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.nombre}`} onClick={() => setPorBorrar(item)}><DeleteIcon /></Button></Stack></Paper>) : listaPrendas.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}><Typography>{item.numero} · {ETIQUETA_TIPO[item.tipo] ?? item.tipo} · {ETIQUETA_ESTADO[item.estado] ?? item.estado}{item.hermano ? ` · ${item.hermano.nombre} ${item.hermano.apellidos}${item.hermano.numeroHermano ? ` (nº ${item.hermano.numeroHermano})` : ''}` : ''}</Typography><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>{item.estado === 'DISPONIBLE' && <Button aria-label={`Prestar ${item.numero}`} onClick={() => setPrestando(item)}>Prestar</Button>}{item.estado === 'PRESTADA' && <Button aria-label={`Devolver ${item.numero}`} onClick={() => setDevolviendo(item)}>Devolver</Button>}<Button aria-label={`Editar ${item.numero}`} component={Link} to={`/cms/inventario/${item.id}/editar?tipo=prenda`} state={{ volver: consultaListado }}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.numero}`} onClick={() => setPorBorrar(item)}><DeleteIcon /></Button></Stack></Paper>)}{(tab === 0 ? metaEnseres : metaPrendas) && (tab === 0 ? listaEnseres : listaPrendas).length === 0 && <Alert severity="info">{tab === 0 ? 'No hay enseres con esta búsqueda o estos filtros.' : 'No hay prendas con esta búsqueda o estos filtros.'}</Alert>}</Stack>
    {tab === 0
      ? metaEnseres && <Paginador meta={metaEnseres} onPagina={enseres.irAPagina} onTamano={enseres.cambiarTamano} etiqueta="los enseres" />
      : metaPrendas && <Paginador meta={metaPrendas} onPagina={prendas.irAPagina} onTamano={prendas.cambiarTamano} etiqueta="las prendas del ropero" />}
  </>
}
