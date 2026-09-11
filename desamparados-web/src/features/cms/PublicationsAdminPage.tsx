import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Link, useLocation } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import CampoImagen from './CampoImagen'
import VentanaFormulario from './VentanaFormulario'
import { AYUDA_PORTADA, ETIQUETA_PORTADA } from './portadaPublicacion'
import { createPublication, deletePublication, getAdminPublications, type ApiPublication, type PublicationPayload } from '../../lib/api/publications'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import type { PublicationItem } from '../../types'

const categories: { value: PublicationItem['category']; label: string }[] = [
  { value: 'boletin', label: 'Boletín' }, { value: 'dossier', label: 'Dossier de prensa' },
  { value: 'anuario', label: 'Anuario' }, { value: 'historia', label: 'Historia' },
]
const emptyForm: PublicationPayload = { titulo: '', descripcion: '', imagenUrl: '', archivoUrl: '', categoria: 'boletin', visible: true }

export default function PublicationsAdminPage() {
  const [items, setItems] = useState<ApiPublication[]>([])
  const [form, setForm] = useState<PublicationPayload>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [porBorrar, setPorBorrar] = useState<ApiPublication | null>(null)
  const [creando, setCreando] = useState(false)
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  // La consulta actual viaja con el enlace de editar (página, tamaño y filtros):
  // así la pantalla de edición sabe a qué página del listado devolver.
  const { search: consultaListado } = useLocation()
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de crear o borrar la omiten: no hay carrera.
  const load = useCallback(
    (vigente: () => boolean = () => true) => getAdminPublications({ pagina, porPagina }).then((respuesta) => { if (!vigente()) return; setItems(respuesta.data); setMeta(respuesta.meta) }),
    [pagina, porPagina]
  )

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar las publicaciones.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])
  const updateField = (field: keyof PublicationPayload, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }))
  // El formulario se limpia al abrir y no al cerrar: así no se vacía a la vista mientras la ventana se va.
  const abrirAlta = () => { setForm(emptyForm); setErrorAlta(null); setCreando(true) }
  const save = async () => {
    setSaving(true); setErrorAlta(null); setNotice(null)
    try { await createPublication(form) }
    catch (err: unknown) { setErrorAlta(err instanceof Error ? err.message : 'No se ha podido guardar la publicación.'); return }
    finally { setSaving(false) }
    setCreando(false)
    setNotice('Publicación creada correctamente.')
    await load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar las publicaciones.'))
  }
  const borrar = async () => { if (!porBorrar) return; try { await deletePublication(porBorrar.id); await load(); setNotice('Publicación eliminada correctamente.') } catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar la publicación.') } finally { setPorBorrar(null) } }

  return <>
    <Helmet><title>Publicaciones | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Publicaciones">
      <Button variant="contained" startIcon={<AddIcon />} onClick={abrirAlta}>Nueva publicación</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <VentanaFormulario
      abierto={creando}
      titulo="Nueva publicación"
      ancho="md"
      sucio={JSON.stringify(form) !== JSON.stringify(emptyForm)}
      guardando={saving}
      puedeGuardar={Boolean(form.titulo && form.archivoUrl)}
      error={errorAlta}
      onGuardar={save}
      onCerrar={() => setCreando(false)}
    >
      <TextField label="Título" value={form.titulo} onChange={(e) => updateField('titulo', e.target.value)} fullWidth />
      <TextField label="Descripción" value={form.descripcion} onChange={(e) => updateField('descripcion', e.target.value)} fullWidth multiline />
      <TextField select label="Categoría" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} fullWidth>{categories.map((category) => <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>)}</TextField>
      <TextField label="URL del archivo PDF" value={form.archivoUrl} onChange={(e) => updateField('archivoUrl', e.target.value)} fullWidth />
      <CampoImagen etiqueta={ETIQUETA_PORTADA} ayuda={AYUDA_PORTADA} valor={form.imagenUrl ?? ''} onCambio={(ruta) => updateField('imagenUrl', ruta)} />
      <TextField label="Fecha" type="date" value={form.fecha ?? ''} onChange={(e) => updateField('fecha', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Switch checked={form.visible} onChange={(e) => updateField('visible', e.target.checked)} /> Visible públicamente</Box>
    </VentanaFormulario>
    <DialogoConfirmacion abierto={porBorrar !== null} titulo="¿Eliminar la publicación?" mensaje={porBorrar ? porBorrar.titulo : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} />
    {loading ? <CircularProgress aria-label="Cargando publicaciones" /> : <Stack spacing={2}>{items.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h6">{item.titulo}</Typography><Typography variant="body2" color="text.secondary">{new Date(item.fecha).toLocaleDateString('es-ES')} · {item.visible ? 'Publicada' : 'Borrador'}</Typography></Box><Stack direction="row"><Button aria-label={`Editar ${item.titulo}`} component={Link} to={`/cms/publicaciones/${item.id}/editar`} state={{ volver: consultaListado }}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.titulo}`} onClick={() => setPorBorrar(item)}><DeleteIcon /></Button></Stack></Paper>)}{items.length === 0 && <Alert severity="info">No hay publicaciones en el archivo.</Alert>}</Stack>}
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="publicaciones" />}
  </>
}
