import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import { createCategory, createTransaction, getBalance, getCategories, getLedger, type Balance, type Category, type Transaction } from '../../lib/api/accounting'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'

type Tipo = Category['tipo']
const apunteVacio = { tipo: 'INGRESO' as Tipo, categoriaId: '', concepto: '', importe: '' }
const categoriaVacia = { nombre: '', tipo: 'INGRESO' as Tipo }

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

export default function AccountingAdminPage() {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [ledger, setLedger] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
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
  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de crear categoría o apunte la omiten: no hay carrera.
  const load = useCallback((vigente: () => boolean = () => true) => Promise.all([getBalance(), getLedger({ pagina, porPagina }), getCategories()]).then(([b, l, c]) => { if (!vigente()) return; setBalance(b); setLedger(l.data); setMeta(l.meta); setCategories(c) }), [pagina, porPagina])
  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(mensaje(e, 'No se ha podido cargar la contabilidad.')) })
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

    {balance && <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 4 }}>{[['Ingresos', balance.ingresos], ['Gastos', balance.gastos], ['Balance', balance.balanceTotal]].map(([label, value]) => <Paper key={label} sx={{ p: 3, flex: 1 }}><Typography variant="overline">{label}</Typography><Typography variant="h4">{Number(value).toFixed(2)} €</Typography></Paper>)}</Stack>}
    <Typography variant="h4" sx={{ mb: 2 }}>Libro mayor</Typography>
    <Stack spacing={2}>{ledger.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', gap: 2 }}><Typography>{item.concepto} · {item.categoria.nombre}</Typography><Typography color={item.tipo === 'INGRESO' ? 'success.main' : 'error.main'}>{item.tipo === 'INGRESO' ? '+' : '-'}{Number(item.importe).toFixed(2)} €</Typography></Paper>)}</Stack>
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="libro mayor" />}
  </>
}
