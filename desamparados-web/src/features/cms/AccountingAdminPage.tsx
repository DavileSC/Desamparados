import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import AddIcon from '@mui/icons-material/Add'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import { createCategory, createTransaction, getCategories, getLedger, getResumen, type Category, type ResumenContable, type Transaction } from '../../lib/api/accounting'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import BarraFiltros from './contabilidad/BarraFiltros'
import CifrasPeriodo from './contabilidad/CifrasPeriodo'
import GraficaMeses from './contabilidad/GraficaMeses'
import RepartoCategorias from './contabilidad/RepartoCategorias'
import LibroCaja from './contabilidad/LibroCaja'
import { PERIODO_POR_DEFECTO, aFiltrosApi, leerFiltrosUrl, type FiltrosUi } from './contabilidad/filtros'

type Tipo = Category['tipo']
const apunteVacio = { tipo: 'INGRESO' as Tipo, categoriaId: '', concepto: '', importe: '' }
const categoriaVacia = { nombre: '', tipo: 'INGRESO' as Tipo }
// Valor de cada filtro que equivale a no filtrar: no se escribe en la URL.
const SIN_FILTRO: Partial<Record<keyof FiltrosUi, string>> = { tipo: 'TODO', periodo: PERIODO_POR_DEFECTO }

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

export default function AccountingAdminPage() {
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => leerFiltrosUrl(params), [params])
  // Se memoriza por su texto: `aFiltrosApi` cuenta los periodos desde hoy y
  // devolvería un objeto nuevo en cada render, relanzando las cargas sin fin.
  const claveFiltros = JSON.stringify(aFiltrosApi(filtros))
  const filtrosApi = useMemo(() => JSON.parse(claveFiltros) as ReturnType<typeof aFiltrosApi>, [claveFiltros])

  const [resumen, setResumen] = useState<ResumenContable | null>(null)
  const [ledger, setLedger] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(apunteVacio)
  const [category, setCategory] = useState(categoriaVacia)
  // Qué ventana de alta está abierta: el apunte o la categoría.
  const [ventana, setVentana] = useState<'apunte' | 'categoria' | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  /** Cambia filtros en la URL y vuelve a la primera página: la 7 de otra consulta no tiene sentido. */
  const cambiarFiltros = useCallback((cambios: Partial<FiltrosUi>) => {
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      for (const [clave, valor] of Object.entries(cambios)) {
        if (!valor || valor === SIN_FILTRO[clave as keyof FiltrosUi]) siguientes.delete(clave)
        else siguientes.set(clave, valor)
      }
      siguientes.delete('pagina')
      return siguientes
    }, { replace: true })
  }, [setParams])

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // cambios rápidos de filtro o de página lanzan dos cargas que pueden
  // resolverse en orden inverso y dejar en pantalla los datos de una consulta
  // con la URL diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  const load = useCallback((vigente: () => boolean = () => true) => Promise.all([
    getResumen(filtrosApi),
    getLedger({ pagina, porPagina }, filtrosApi),
    getCategories(),
  ]).then(([r, l, c]) => {
    if (!vigente()) return
    setResumen(r); setLedger(l.data); setMeta(l.meta); setCategories(c); setError(null)
  }), [filtrosApi, pagina, porPagina])

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar la contabilidad.')) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [load])

  // Cada ventana se limpia al abrirse, no al cerrarse: así no se vacía a la vista mientras se va.
  const abrir = (cual: 'apunte' | 'categoria') => {
    if (cual === 'apunte') setForm(apunteVacio)
    else setCategory(categoriaVacia)
    setErrorAlta(null)
    setVentana(cual)
  }

  /** Guarda lo de la ventana abierta; si falla, la ventana sigue abierta con el motivo. */
  const guardar = async (peticion: () => Promise<unknown>, aviso: string, porDefecto: string) => {
    setGuardando(true); setErrorAlta(null); setNotice(null)
    try { await peticion() }
    catch (e: unknown) { setErrorAlta(mensaje(e, porDefecto)); return }
    finally { setGuardando(false) }
    setVentana(null)
    setNotice(aviso)
    await load().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar la contabilidad.')))
  }

  const saveCategory = () => guardar(() => createCategory(category), 'Categoría creada correctamente.', 'No se ha podido crear la categoría.')
  const save = () => guardar(
    () => createTransaction({ ...form, categoriaId: Number(form.categoriaId), importe: Number(form.importe) }),
    'Transacción registrada correctamente.',
    'No se ha podido registrar la transacción.',
  )
  const available = categories.filter((item) => item.tipo === form.tipo)

  return <>
    <Helmet><title>Contabilidad | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Contabilidad">
      <Button variant="outlined" startIcon={<SellOutlinedIcon />} onClick={() => abrir('categoria')}>Nueva categoría</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrir('apunte')}>Nuevo apunte</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}

    <VentanaFormulario
      abierto={ventana === 'apunte'}
      titulo="Nuevo apunte"
      textoGuardar="Registrar"
      sucio={JSON.stringify(form) !== JSON.stringify(apunteVacio)}
      guardando={guardando}
      puedeGuardar={Boolean(form.categoriaId) && form.concepto.length >= 4 && Number(form.importe) > 0}
      error={errorAlta}
      onGuardar={save}
      onCerrar={() => setVentana(null)}
    >
      <TextField select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo, categoriaId: '' })} fullWidth>
        <MenuItem value="INGRESO">Ingreso</MenuItem>
        <MenuItem value="GASTO">Gasto</MenuItem>
      </TextField>
      <TextField
        select
        label="Categoría"
        value={form.categoriaId}
        onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
        helperText={available.length === 0 ? `No hay categorías de ${form.tipo === 'INGRESO' ? 'ingreso' : 'gasto'}: créala primero con «Nueva categoría».` : undefined}
        fullWidth
      >
        {available.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.nombre}</MenuItem>)}
      </TextField>
      <TextField label="Concepto" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} fullWidth />
      <TextField label="Importe (€)" type="number" slotProps={{ htmlInput: { min: 0, step: 0.01 } }} value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} fullWidth />
    </VentanaFormulario>

    <VentanaFormulario
      abierto={ventana === 'categoria'}
      titulo="Nueva categoría"
      textoGuardar="Crear categoría"
      sucio={JSON.stringify(category) !== JSON.stringify(categoriaVacia)}
      guardando={guardando}
      puedeGuardar={category.nombre.length >= 3}
      error={errorAlta}
      onGuardar={saveCategory}
      onCerrar={() => setVentana(null)}
    >
      <TextField label="Nombre" value={category.nombre} onChange={(e) => setCategory({ ...category, nombre: e.target.value })} fullWidth />
      <TextField select label="Tipo" value={category.tipo} onChange={(e) => setCategory({ ...category, tipo: e.target.value as Tipo })} fullWidth>
        <MenuItem value="INGRESO">Ingreso</MenuItem>
        <MenuItem value="GASTO">Gasto</MenuItem>
      </TextField>
    </VentanaFormulario>

    <BarraFiltros filtros={filtros} categorias={categories} onCambiar={cambiarFiltros} />

    {cargando && !resumen ? <CircularProgress aria-label="Cargando la contabilidad" /> : resumen && <>
      <CifrasPeriodo resumen={resumen} tipo={filtros.tipo} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 2, mb: 3, alignItems: 'stretch' }}>
        <GraficaMeses serie={resumen.serie} tipo={filtros.tipo} />
        <RepartoCategorias categorias={resumen.categorias} totales={resumen.totales} tipo={filtros.tipo} elegida={filtros.categoria} onElegir={(id) => cambiarFiltros({ categoria: id })} />
      </Box>
    </>}

    <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography variant="h4" component="h2">Libro de caja</Typography>
      {meta && <Typography variant="body2" color="text.secondary">Lo más reciente arriba</Typography>}
    </Stack>
    <LibroCaja apuntes={ledger} totales={resumen?.totales ?? null} tipo={filtros.tipo} />
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="libro mayor" />}
  </>
}
