import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Link, useLocation } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
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

  const reset = () => setForm(emptyForm)

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await createNews(form)
      await load()
      reset()
      setNotice('Noticia creada correctamente.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar la noticia.')
    } finally { setSaving(false) }
  }

  const borrar = async () => {
    if (!porBorrar) return
    try { await deleteNews(porBorrar.id); await load(); setNotice('Noticia eliminada correctamente.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar la noticia.') }
    finally { setPorBorrar(null) }
  }

  return <>
    <Helmet><title>Noticias | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <Typography variant="h2" component="h1" sx={{ mb: 4 }}>Noticias</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <Paper sx={{ p: { xs: 2, md: 4 }, mb: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Nueva noticia</Typography>
        <TextField label="Título" value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} fullWidth />
        <TextField label="Extracto" value={form.extracto} onChange={(event) => updateField('extracto', event.target.value)} fullWidth multiline />
        <TextField label="Contenido HTML" value={form.contenido} onChange={(event) => updateField('contenido', event.target.value)} fullWidth multiline minRows={7} />
        <TextField label="URL de imagen" value={form.imagenUrl} onChange={(event) => updateField('imagenUrl', event.target.value)} fullWidth />
        <TextField label="Slug (opcional)" value={form.slug ?? ''} onChange={(event) => updateField('slug', event.target.value)} fullWidth />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Switch checked={form.visible} onChange={(event) => updateField('visible', event.target.checked)} /> Visible públicamente</Box>
        <Stack direction="row" spacing={2}><Button variant="contained" startIcon={<AddIcon />} onClick={save} disabled={saving || !form.titulo || !form.contenido}>{saving ? 'Guardando...' : 'Guardar'}</Button></Stack>
      </Stack>
    </Paper>
    <Typography variant="h4" sx={{ mb: 2 }}>Archivo editorial</Typography>
    <DialogoConfirmacion abierto={porBorrar !== null} titulo="¿Eliminar la noticia?" mensaje={porBorrar ? porBorrar.titulo : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} />
    {loading ? <CircularProgress aria-label="Cargando noticias" /> : <Stack spacing={2}>{items.map((item) => <Paper key={item.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h6">{item.titulo}</Typography><Typography variant="body2" color="text.secondary">{new Date(item.fecha).toLocaleDateString('es-ES')} · {item.visible ? 'Publicada' : 'Borrador'}</Typography></Box><Stack direction="row"><Button aria-label={`Editar ${item.titulo}`} component={Link} to={`/cms/noticias/${item.id}/editar`} state={{ volver: consultaListado }}><EditIcon /></Button><Button color="error" aria-label={`Eliminar ${item.titulo}`} onClick={() => setPorBorrar(item)}><DeleteIcon /></Button></Stack></Paper>)}{items.length === 0 && <Alert severity="info">No hay noticias en el archivo.</Alert>}</Stack>}
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="noticias" />}
  </>
}
