import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import AddIcon from '@mui/icons-material/Add'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import {
  createCategory,
  createTransaction,
  deleteTransaction,
  getCategories,
  getLedger,
  getResumen,
  renameCategory,
  setCategoryActive,
  updateTransaction,
  type Category,
  type ResumenContable,
  type Transaction,
} from '../../lib/api/accounting'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import type { MetaPaginacion } from '../../lib/api/tipos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import BarraFiltros from './contabilidad/BarraFiltros'
import CifrasPeriodo from './contabilidad/CifrasPeriodo'
import GraficaMeses from './contabilidad/GraficaMeses'
import RepartoCategorias from './contabilidad/RepartoCategorias'
import LibroCaja from './contabilidad/LibroCaja'
import CamposApunte from './contabilidad/CamposApunte'
import GestionCategorias from './contabilidad/GestionCategorias'
import { PERIODO_POR_DEFECTO, aFiltrosApi, fechasInvertidas, leerFiltrosUrl, type FiltrosUi } from './contabilidad/filtros'
import { aApunteManual, apunteCompleto, apunteDesde, apunteNuevo, errorNombreCategoria, type FormApunte } from './contabilidad/apunte'
import { euros, fechaCorta } from './contabilidad/formato'

type Tipo = Category['tipo']
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
  // Unas fechas al revés no se piden: el servidor respondería 400.
  const alReves = fechasInvertidas(filtros)

  const [resumen, setResumen] = useState<ResumenContable | null>(null)
  const [ledger, setLedger] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<FormApunte>(() => apunteNuevo())
  // Cómo estaba el formulario al abrirse: cerrar con cambios pregunta antes.
  const [formInicial, setFormInicial] = useState<FormApunte>(form)
  // El apunte que se está corrigiendo; `null` es un apunte nuevo.
  const [corrigiendo, setCorrigiendo] = useState<Transaction | null>(null)
  const [porBorrar, setPorBorrar] = useState<Transaction | null>(null)
  const [category, setCategory] = useState(categoriaVacia)
  // Qué ventana de formulario está abierta: el apunte o el alta de categoría.
  const [ventana, setVentana] = useState<'apunte' | 'categoria' | null>(null)
  // La gestión de categorías va aparte: el alta de categoría se abre encima de ella.
  const [gestionAbierta, setGestionAbierta] = useState(false)
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

  // Todas, también las desactivadas: los filtros del histórico y la gestión
  // las necesitan. El formulario de apunte ya ofrece solo las activas.
  const cargarCategorias = useCallback(() => getCategories(undefined, true).then(setCategories), [])

  useEffect(() => {
    cargarCategorias().catch((e: unknown) => setError(mensaje(e, 'No se han podido cargar las categorías.')))
  }, [cargarCategorias])

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // cambios rápidos de filtro o de página lanzan dos cargas que pueden
  // resolverse en orden inverso y dejar en pantalla los datos de una consulta
  // con la URL diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  const load = useCallback((vigente: () => boolean = () => true) => {
    if (alReves) return Promise.resolve()
    return Promise.all([
      getResumen(filtrosApi),
      getLedger({ pagina, porPagina }, filtrosApi),
    ]).then(([r, l]) => {
      if (!vigente()) return
      setResumen(r); setLedger(l.data); setMeta(l.meta); setError(null)
    })
  }, [filtrosApi, pagina, porPagina, alReves])

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar la contabilidad.')) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [load])

  const recargar = () => load().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar la contabilidad.')))

  // Cada ventana se limpia al abrirse, no al cerrarse: así no se vacía a la vista mientras se va.
  const abrirApunte = (apunte: Transaction | null) => {
    const inicial = apunte ? apunteDesde(apunte) : apunteNuevo()
    setForm(inicial); setFormInicial(inicial); setCorrigiendo(apunte)
    setErrorAlta(null)
    setVentana('apunte')
  }
  const abrirCategoria = () => {
    setCategory(categoriaVacia)
    setErrorAlta(null)
    setVentana('categoria')
  }

  /** Guarda lo de la ventana abierta; si falla, la ventana sigue abierta con el motivo. */
  const guardar = async (peticion: () => Promise<unknown>, aviso: string, porDefecto: string, despues: () => Promise<unknown> = recargar) => {
    setGuardando(true); setErrorAlta(null); setNotice(null)
    try { await peticion() }
    catch (e: unknown) { setErrorAlta(mensaje(e, porDefecto)); return }
    finally { setGuardando(false) }
    setVentana(null)
    setNotice(aviso)
    await despues()
  }

  const saveCategory = () => guardar(
    () => createCategory({ nombre: category.nombre.trim(), tipo: category.tipo }),
    'Categoría creada correctamente.',
    'No se ha podido crear la categoría.',
    () => cargarCategorias().catch((e: unknown) => setError(mensaje(e, 'No se han podido cargar las categorías.'))),
  )
  const save = () => corrigiendo
    ? guardar(() => updateTransaction(corrigiendo.id, aApunteManual(form)), 'Apunte corregido.', 'No se ha podido corregir el apunte.')
    : guardar(() => createTransaction(aApunteManual(form)), 'Transacción registrada correctamente.', 'No se ha podido registrar la transacción.')

  const borrar = async () => {
    const apunte = porBorrar
    setPorBorrar(null)
    if (!apunte) return
    setNotice(null)
    try {
      await deleteTransaction(apunte.id)
      setNotice('Apunte borrado.')
      await recargar()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido borrar el apunte.'))
    }
  }

  // Renombrar o desactivar cambia nombres en el libro y en el reparto: se recarga todo.
  const trasCambiarCategoria = async () => { await cargarCategorias(); await recargar() }
  const renombrar = async (id: number, nombre: string) => { await renameCategory(id, nombre); await trasCambiarCategoria() }
  const cambiarEstado = async (id: number, activa: boolean) => { await setCategoryActive(id, activa); await trasCambiarCategoria() }

  const sucio = JSON.stringify(form) !== JSON.stringify(formInicial)

  return <>
    <Helmet><title>Contabilidad | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Contabilidad">
      <Button variant="outlined" startIcon={<SellOutlinedIcon />} onClick={() => setGestionAbierta(true)}>Categorías</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirApunte(null)}>Nuevo apunte</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}

    <VentanaFormulario
      abierto={ventana === 'apunte'}
      titulo={corrigiendo ? 'Corregir apunte' : 'Nuevo apunte'}
      textoGuardar={corrigiendo ? 'Guardar cambios' : 'Registrar'}
      sucio={sucio}
      guardando={guardando}
      // Corregir sin cambiar nada solo llenaría la auditoría de registros vacíos.
      puedeGuardar={apunteCompleto(form) && (!corrigiendo || sucio)}
      error={errorAlta}
      onGuardar={save}
      onCerrar={() => setVentana(null)}
    >
      {corrigiendo && (
        <Typography variant="body2" color="text.secondary">
          Corregirlo evita el contraapunte, que inflaría a la vez los ingresos y los gastos. El registro de auditoría guarda cómo estaba.
        </Typography>
      )}
      <CamposApunte form={form} onCambiar={setForm} categorias={categories} categoriaOriginal={corrigiendo?.categoriaId != null ? String(corrigiendo.categoriaId) : undefined} />
    </VentanaFormulario>

    <GestionCategorias
      abierto={gestionAbierta}
      categorias={categories}
      onCerrar={() => setGestionAbierta(false)}
      onNueva={abrirCategoria}
      onRenombrar={renombrar}
      onCambiarEstado={cambiarEstado}
    />

    <VentanaFormulario
      abierto={ventana === 'categoria'}
      titulo="Nueva categoría"
      textoGuardar="Crear categoría"
      sucio={JSON.stringify(category) !== JSON.stringify(categoriaVacia)}
      guardando={guardando}
      puedeGuardar={!errorNombreCategoria(category.nombre)}
      error={errorAlta}
      onGuardar={saveCategory}
      onCerrar={() => setVentana(null)}
    >
      <TextField label="Nombre" value={category.nombre} onChange={(e) => setCategory({ ...category, nombre: e.target.value })} slotProps={{ htmlInput: { maxLength: 60 } }} fullWidth />
      <TextField select label="Tipo" value={category.tipo} onChange={(e) => setCategory({ ...category, tipo: e.target.value as Tipo })} fullWidth>
        <MenuItem value="INGRESO">Ingreso</MenuItem>
        <MenuItem value="GASTO">Gasto</MenuItem>
      </TextField>
    </VentanaFormulario>

    <DialogoConfirmacion
      abierto={porBorrar !== null}
      titulo="¿Borrar el apunte?"
      mensaje={porBorrar ? `«${porBorrar.concepto}», ${euros(Number(porBorrar.importe))} del ${fechaCorta(porBorrar.fecha)}. Desaparece del libro de caja y de las cifras; el registro de auditoría guarda cómo era.` : ''}
      textoConfirmar="Borrar"
      peligro
      onConfirmar={() => void borrar()}
      onCancelar={() => setPorBorrar(null)}
    />

    <BarraFiltros filtros={filtros} categorias={categories} onCambiar={cambiarFiltros} />

    {alReves ? (
      <Alert severity="warning" sx={{ mb: 3 }}>La fecha «Hasta» es anterior a «Desde». Corrígela para ver las cifras y el libro de caja.</Alert>
    ) : <>
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
      <LibroCaja apuntes={ledger} totales={resumen?.totales ?? null} tipo={filtros.tipo} onCorregir={(a) => abrirApunte(a)} onBorrar={setPorBorrar} />
      {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="libro mayor" />}
    </>}
  </>
}
