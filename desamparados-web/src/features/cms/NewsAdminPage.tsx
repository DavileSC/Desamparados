import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Link, useLocation } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import CampoImagen from './CampoImagen'
import EditorTexto from './EditorTexto'
import VentanaFormulario from './VentanaFormulario'
import { createNews, deleteNews, getAdminNews, type ApiNews, type NewsPayload } from '../../lib/api/news'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

const emptyForm: NewsPayload = { titulo: '', contenido: '', extracto: '', imagenUrl: '', visible: true }

export default function NewsAdminPage() {
  const [items, setItems] = useState<ApiNews[]>([])
  const [form, setForm] = useState<NewsPayload>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [porBorrar, setPorBorrar] = useState<ApiNews | null>(null)
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
    (vigente: () => boolean = () => true) => getAdminNews({ pagina, porPagina }).then((response) => { if (!vigente()) return; setItems(response.data); setMeta(response.meta) }),
    [pagina, porPagina]
  )

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar las noticias.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  const updateField = (field: keyof NewsPayload, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }))

  // El formulario se limpia al abrir y no al cerrar: así no se vacía a la vista mientras la ventana se va.
  const abrirAlta = () => { setForm(emptyForm); setErrorAlta(null); setCreando(true) }

  const save = async () => {
    setSaving(true)
    setErrorAlta(null)
    setNotice(null)
    try {
      await createNews(form)
    } catch (err: unknown) {
      setErrorAlta(err instanceof Error ? err.message : 'No se ha podido guardar la noticia.')
      return
    } finally { setSaving(false) }
    setCreando(false)
    setNotice('Noticia creada correctamente.')
    await load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar las noticias.'))
  }

  const borrar = async () => {
    if (!porBorrar) return
    try { await deleteNews(porBorrar.id); await load(); setNotice('Noticia eliminada correctamente.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar la noticia.') }
    finally { setPorBorrar(null) }
  }

  return <>
    <Helmet><title>Noticias | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Noticias">
      <Button variant="contained" startIcon={<AddIcon />} onClick={abrirAlta}>Nueva noticia</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <VentanaFormulario
      abierto={creando}
      titulo="Nueva noticia"
      ancho="md"
      sucio={JSON.stringify(form) !== JSON.stringify(emptyForm)}
      guardando={saving}
      puedeGuardar={Boolean(form.titulo && form.contenido)}
      error={errorAlta}
      onGuardar={save}
      onCerrar={() => setCreando(false)}
    >
      <TextField label="Título" value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} fullWidth />
      <TextField label="Extracto" value={form.extracto} onChange={(event) => updateField('extracto', event.target.value)} fullWidth multiline />
      <EditorTexto valor={form.contenido} onCambio={(html) => updateField('contenido', html)} etiqueta="Contenido de la noticia" />
      <CampoImagen valor={form.imagenUrl ?? ''} onCambio={(ruta) => updateField('imagenUrl', ruta)} />
      <TextField label="Slug (opcional)" value={form.slug ?? ''} onChange={(event) => updateField('slug', event.target.value)} fullWidth />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Switch checked={form.visible} onChange={(event) => updateField('visible', event.target.checked)} /> Visible públicamente</Box>
    </VentanaFormulario>
    <DialogoConfirmacion abierto={porBorrar !== null} titulo="¿Eliminar la noticia?" mensaje={porBorrar ? porBorrar.titulo : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} />
    {loading ? <CircularProgress aria-label="Cargando noticias" /> : <Stack spacing={2}>{items.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h6">{item.titulo}</Typography><Typography variant="body2" color="text.secondary">{new Date(item.fecha).toLocaleDateString('es-ES')} · {item.visible ? 'Publicada' : 'Borrador'}</Typography></Box><Stack direction="row"><Button aria-label={`Editar ${item.titulo}`} component={Link} to={`/cms/noticias/${item.id}/editar`} state={{ volver: consultaListado }}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.titulo}`} onClick={() => setPorBorrar(item)}><DeleteIcon /></Button></Stack></Paper>)}{items.length === 0 && <Alert severity="info">No hay noticias en el archivo.</Alert>}</Stack>}
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="noticias" />}
  </>
}
