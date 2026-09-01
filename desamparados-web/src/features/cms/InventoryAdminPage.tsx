import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, MenuItem, Paper, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Link } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import { assignPrenda, createEnser, createPrenda, deleteEnser, deletePrenda, getEnseres, getPrendas, returnPrenda, type Enser, type Prenda } from '../../lib/api/inventory'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

const emptyEnser = { nombre: '', referencia: '', categoria: '', ubicacion: '', cantidadOptimo: '0', cantidadBueno: '0', cantidadReparar: '0' }
const emptyPrenda = { numero: '', tipo: 'TUNICA', talla: '', estado: 'DISPONIBLE', observaciones: '' }

export default function InventoryAdminPage() {
  const [tab, setTab] = useState(0)
  const [listaEnseres, setListaEnseres] = useState<Enser[]>([])
  const [listaPrendas, setListaPrendas] = useState<Prenda[]>([])
  const [enserForm, setEnserForm] = useState(emptyEnser)
  const [prendaForm, setPrendaForm] = useState(emptyPrenda)
  const [assignIds, setAssignIds] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [porBorrar, setPorBorrar] = useState<Enser | Prenda | null>(null)
  // Dos listados independientes en la misma pantalla, cada uno con su
  // paginación: con un parámetro compartido, pasar de página en los enseres
  // movería también el ropero. El prefijo separa ?paginaEnseres= de ?paginaPrendas=.
  const enseres = usePaginacion('Enseres')
  const prendas = usePaginacion('Prendas')
  const [metaEnseres, setMetaEnseres] = useState<MetaPaginacion | null>(null)
  const [metaPrendas, setMetaPrendas] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en cualquiera de los dos paginadores lanzan dos cargas que
  // pueden resolverse en orden inverso y dejar en pantalla los datos de una
  // página con la URL diciendo otra. Solo la última carga en marcha tiene
  // derecho a escribir. Las llamadas de después de crear, borrar, asignar o
  // devolver la omiten: no hay carrera.
  const load = useCallback((vigente: () => boolean = () => true) => Promise.all([
    getEnseres({ pagina: enseres.pagina, porPagina: enseres.porPagina }),
    getPrendas({ pagina: prendas.pagina, porPagina: prendas.porPagina }),
  ]).then(([a, b]) => { if (!vigente()) return; setListaEnseres(a.data); setMetaEnseres(a.meta); setListaPrendas(b.data); setMetaPrendas(b.meta) }), [enseres.pagina, enseres.porPagina, prendas.pagina, prendas.porPagina])

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se ha podido cargar el inventario.') })
    return () => { cancelado = true }
  }, [load])
  const reset = () => { setEnserForm(emptyEnser); setPrendaForm(emptyPrenda) }
  const saveEnser = async () => { try { const data = { ...enserForm, cantidadOptimo: Number(enserForm.cantidadOptimo), cantidadBueno: Number(enserForm.cantidadBueno), cantidadReparar: Number(enserForm.cantidadReparar) }; await createEnser(data); await load(); reset(); setNotice('Enser creado correctamente.') } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se ha podido guardar el enser.') } }
  const savePrenda = async () => { try { await createPrenda(prendaForm); await load(); reset(); setNotice('Prenda creada correctamente.') } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se ha podido guardar la prenda.') } }
  const nombreDe = (item: Enser | Prenda) => ('nombre' in item ? item.nombre : `Prenda ${item.numero}`)
  const borrar = async () => { if (!porBorrar) return; try { if (tab === 0) await deleteEnser(porBorrar.id); else await deletePrenda(porBorrar.id); await load(); setNotice('Elemento eliminado correctamente.') } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se ha podido eliminar el elemento.') } finally { setPorBorrar(null) } }
  const assign = async (item: Prenda) => { const hermanoId = Number(assignIds[item.id]); if (!Number.isInteger(hermanoId) || hermanoId <= 0) return; try { await assignPrenda(item.id, hermanoId); await load(); setNotice('Prenda asignada correctamente.') } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se ha podido asignar la prenda.') } }
  const returnItem = async (item: Prenda) => { try { await returnPrenda(item.id, window.confirm('¿La prenda necesita lavado o pasar a taller?')); await load(); setNotice('Prenda devuelta correctamente.') } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se ha podido registrar la devolución.') } }
  return <><Helmet><title>Inventario | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet><Typography variant="h2" component="h1" sx={{ mb: 4 }}>Inventario</Typography>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}<DialogoConfirmacion abierto={porBorrar !== null} titulo={tab === 0 ? '¿Eliminar el enser?' : '¿Eliminar la prenda?'} mensaje={porBorrar ? nombreDe(porBorrar) : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} /><Tabs value={tab} onChange={(_, value) => { setTab(value); reset() }} sx={{ mb: 3 }}><Tab label="Enseres" /><Tab label="Ropero" /></Tabs>{tab === 0 ? <Paper sx={{ p: 3, mb: 3 }}><Stack spacing={2}><Typography variant="h4">Nuevo enser</Typography>{(['nombre', 'referencia', 'categoria', 'ubicacion'] as const).map((field) => <TextField key={field} label={field} value={enserForm[field]} onChange={(e) => setEnserForm({ ...enserForm, [field]: e.target.value })} />)}<Stack direction="row" spacing={2}>{(['cantidadOptimo', 'cantidadBueno', 'cantidadReparar'] as const).map((field) => <TextField key={field} label={field.replace('cantidad', '')} type="number" value={enserForm[field]} onChange={(e) => setEnserForm({ ...enserForm, [field]: e.target.value })} />)}</Stack><Stack direction="row"><Button variant="contained" onClick={saveEnser} disabled={!enserForm.nombre}>Guardar</Button></Stack></Stack></Paper> : <Paper sx={{ p: 3, mb: 3 }}><Stack spacing={2}><Typography variant="h4">Nueva prenda</Typography><TextField label="Número" value={prendaForm.numero} onChange={(e) => setPrendaForm({ ...prendaForm, numero: e.target.value })} /><Select value={prendaForm.tipo} onChange={(e) => setPrendaForm({ ...prendaForm, tipo: e.target.value as typeof prendaForm.tipo })} aria-label="Tipo de prenda">{['TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</Select><TextField label="Talla" value={prendaForm.talla} onChange={(e) => setPrendaForm({ ...prendaForm, talla: e.target.value })} /><Select value={prendaForm.estado} onChange={(e) => setPrendaForm({ ...prendaForm, estado: e.target.value as typeof prendaForm.estado })} aria-label="Estado">{['DISPONIBLE', 'PRESTADA', 'TALLER', 'BAJA'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</Select><TextField label="Observaciones" value={prendaForm.observaciones} onChange={(e) => setPrendaForm({ ...prendaForm, observaciones: e.target.value })} /><Stack direction="row"><Button variant="contained" onClick={savePrenda} disabled={!prendaForm.numero}>Guardar</Button></Stack></Stack></Paper>}<Stack spacing={2}>{tab === 0 ? listaEnseres.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Typography>{item.nombre} · {item.cantidadTotal} unidades · {item.ubicacion ?? 'Sin ubicación'}</Typography><Stack direction="row"><Button aria-label={`Editar ${item.nombre}`} component={Link} to={`/cms/inventario/${item.id}/editar`}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.nombre}`} onClick={() => setPorBorrar(item)}><DeleteIcon /></Button></Stack></Paper>) : listaPrendas.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}><Typography>{item.numero} · {item.tipo} · {item.estado}{item.hermano ? ` · ${item.hermano.nombre} ${item.hermano.apellidos}` : ''}</Typography><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>{item.estado === 'DISPONIBLE' && <><TextField size="small" label="ID hermano" value={assignIds[item.id] ?? ''} onChange={(e) => setAssignIds({ ...assignIds, [item.id]: e.target.value })} /><Button onClick={() => assign(item)}>Asignar</Button></>}{item.estado === 'PRESTADA' && <Button onClick={() => returnItem(item)}>Devolver</Button>}<Button aria-label={`Editar ${item.numero}`} component={Link} to={`/cms/inventario/${item.id}/editar?tipo=prenda`}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.numero}`} onClick={() => setPorBorrar(item)}><DeleteIcon /></Button></Stack></Paper>)}</Stack>{tab === 0
    ? metaEnseres && <Paginador meta={metaEnseres} onPagina={enseres.irAPagina} onTamano={enseres.cambiarTamano} etiqueta="los enseres" />
    : metaPrendas && <Paginador meta={metaPrendas} onPagina={prendas.irAPagina} onTamano={prendas.cambiarTamano} etiqueta="las prendas del ropero" />}</>
}
