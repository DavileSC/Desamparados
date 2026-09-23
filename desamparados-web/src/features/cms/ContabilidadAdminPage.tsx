import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import AddIcon from '@mui/icons-material/Add'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import {
  crearCategoriaDeApunte,
  crearApunte,
  eliminarApunte,
  listarCategorias,
  libroMayor,
  resumenDeTesoreria,
  renombrarCategoria,
  cambiarEstadoCategoria,
  actualizarApunte,
  type Category,
  type ResumenContable,
  type Transaction,
} from '../../lib/api/contabilidad'
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
import { aApunteManual, apunteCompleto, apunteDesde, apunteNuevo, type FormApunte } from './contabilidad/apunte'
import { euros, fechaCorta } from './contabilidad/formato'
import { useFiltrosUrl } from './listados/useFiltrosUrl'

// Valor de cada filtro que equivale a no filtrar: no se escribe en la URL.
const SIN_FILTRO: Partial<Record<keyof FiltrosUi, string>> = { tipo: 'TODO', periodo: PERIODO_POR_DEFECTO }

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

const ORDENES_LIBRO = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'antiguos', etiqueta: 'Más antiguos' },
  { valor: 'importeDesc', etiqueta: 'Importe: mayor primero' },
  { valor: 'importeAsc', etiqueta: 'Importe: menor primero' },
  { valor: 'concepto', etiqueta: 'Concepto (A-Z)' },
]
// El orden es solo del libro de caja: las cifras y las gráficas no cambian con él.
const ORDEN_LIBRO = { orden: { porDefecto: 'recientes', validos: ORDENES_LIBRO.map((o) => o.valor) } }

export default function ContabilidadAdminPage() {
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
  // La ventana del apunte, nuevo o corregido.
  const [ventana, setVentana] = useState<'apunte' | null>(null)
  // La gestión de categorías va en su ventana, con el alta dentro.
  const [gestionAbierta, setGestionAbierta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  const [{ orden }, cambiarOrden] = useFiltrosUrl(ORDEN_LIBRO)
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
  const cargarCategorias = useCallback(() => listarCategorias(undefined, true).then(setCategories), [])

  useEffect(() => {
    cargarCategorias().catch((e: unknown) => setError(mensaje(e, 'No se han podido cargar las categorías.')))
  }, [cargarCategorias])

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // cambios rápidos de filtro o de página lanzan dos cargas que pueden
  // resolverse en orden inverso y dejar en pantalla los datos de una consulta
  // con la URL diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  const cargar = useCallback((vigente: () => boolean = () => true) => {
    if (alReves) return Promise.resolve()
    return Promise.all([
      resumenDeTesoreria(filtrosApi),
      libroMayor({ pagina, porPagina }, filtrosApi, orden),
    ]).then(([r, l]) => {
      if (!vigente()) return
      setResumen(r); setLedger(l.data); setMeta(l.meta); setError(null)
    })
  }, [filtrosApi, pagina, porPagina, orden, alReves])

  useEffect(() => {
    let cancelado = false
    cargar(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar la contabilidad.')) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [cargar])

  const recargar = () => cargar().catch((e: unknown) => setError(mensaje(e, 'No se ha podido cargar la contabilidad.')))

  // Cada ventana se limpia al abrirse, no al cerrarse: así no se vacía a la vista mientras se va.
  const abrirApunte = (apunte: Transaction | null) => {
    const inicial = apunte ? apunteDesde(apunte) : apunteNuevo()
    setForm(inicial); setFormInicial(inicial); setCorrigiendo(apunte)
    setErrorAlta(null)
    setVentana('apunte')
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

  const save = () => corrigiendo
    ? guardar(() => actualizarApunte(corrigiendo.id, aApunteManual(form)), 'Apunte corregido.', 'No se ha podido corregir el apunte.')
    : guardar(() => crearApunte(aApunteManual(form)), 'Transacción registrada correctamente.', 'No se ha podido registrar la transacción.')

  const borrar = async () => {
    const apunte = porBorrar
    setPorBorrar(null)
    if (!apunte) return
    setNotice(null)
    try {
      await eliminarApunte(apunte.id)
      setNotice('Apunte borrado.')
      await recargar()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido borrar el apunte.'))
    }
  }

  // Renombrar o desactivar cambia nombres en el libro y en el reparto: se recarga todo.
  const trasCambiarCategoria = async () => { await cargarCategorias(); await recargar() }
  const renombrar = async (id: number, nombre: string) => { await renombrarCategoria(id, nombre); await trasCambiarCategoria() }
  const cambiarEstado = async (id: number, activa: boolean) => { await cambiarEstadoCategoria(id, activa); await trasCambiarCategoria() }
  // Se da de alta dentro de la gestión: si falla, el motivo sale allí, junto al campo.
  const crearCategoria = async (nombre: string, tipo: Category['tipo']) => { await crearCategoriaDeApunte({ nombre, tipo }); await cargarCategorias() }

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
      onCrear={crearCategoria}
      onRenombrar={renombrar}
      onCambiarEstado={cambiarEstado}
    />

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
    {filtros.recibo && (
      // Al llegar desde Tesorería: solo los apuntes de ese recibo, de cualquier fecha.
      <Alert
        severity="info"
        sx={{ mb: 3 }}
        action={<Stack direction="row" spacing={1}>
          <Button color="inherit" size="small" component={Link} to={`/cms/tesoreria?recibo=${filtros.recibo}`}>Ver el recibo</Button>
          <Button color="inherit" size="small" onClick={() => cambiarFiltros({ recibo: '' })}>Todo el libro</Button>
        </Stack>}
      >
        Apuntes del recibo #{filtros.recibo}, de cualquier fecha. Los demás filtros no se aplican mientras tanto.
      </Alert>
    )}

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

      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', rowGap: 1.5 }}>
        <Typography variant="h4" component="h2">Libro de caja</Typography>
        <TextField
          select
          size="small"
          label="Ordenar por"
          value={orden}
          onChange={(e) => cambiarOrden({ orden: e.target.value })}
          sx={{ minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SwapVertIcon fontSize="small" /></InputAdornment> } }}
        >
          {ORDENES_LIBRO.map((o) => <MenuItem key={o.valor} value={o.valor}>{o.etiqueta}</MenuItem>)}
        </TextField>
      </Stack>
      <LibroCaja apuntes={ledger} totales={resumen?.totales ?? null} tipo={filtros.tipo} onCorregir={(a) => abrirApunte(a)} onBorrar={setPorBorrar} />
      {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="libro mayor" />}
    </>}
  </>
}
