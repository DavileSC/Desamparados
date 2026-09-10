import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Stack, Switch, TextField } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import { useVolverAlListado } from '../../hooks/useVolverAlListado'
import { getAdminNewsById, updateNews, type NewsPayload } from '../../lib/api/news'

export default function NewsEditPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  // El listado del que se vino, con su página y sus filtros: el enlace de editar
  // los trae en el state. Sin state (URL tecleada) se cae en la ruta pelada.
  const volverAlListado = useVolverAlListado('/cms/noticias')
  const [titulo, setTitulo] = useState('')
  const [form, setForm] = useState<NewsPayload | null>(null)
  const [inicial, setInicial] = useState<NewsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getAdminNewsById(Number(id))
      .then((item) => {
        const datos: NewsPayload = {
          titulo: item.titulo, contenido: item.contenido, extracto: item.extracto ?? '',
          imagenUrl: item.imagenUrl ?? '', visible: item.visible, fecha: item.fecha.slice(0, 10), slug: item.slug,
        }
        setTitulo(item.titulo); setForm(datos); setInicial(datos)
      })
      .catch(() => setError('No se ha podido cargar la noticia.'))
  }, [id])

  const campo = (clave: keyof NewsPayload, valor: string | boolean) => setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))

  const guardar = async () => {
    if (!form) return
    setGuardando(true)
    try {
      await updateNews(Number(id), form)
      navegar(volverAlListado)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la noticia.')
      setGuardando(false)
    }
  }

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form) return <CircularProgress aria-label="Cargando la noticia" />

  return (
    <>
      <Helmet><title>Editar noticia | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo="Editar noticia"
        nombre={titulo}
        sucio={JSON.stringify(form) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA={volverAlListado}
        onGuardar={guardar}
      >
        <Stack spacing={2}>
          <TextField label="Título" value={form.titulo} onChange={(e) => campo('titulo', e.target.value)} fullWidth />
          <TextField label="Extracto" value={form.extracto} onChange={(e) => campo('extracto', e.target.value)} fullWidth multiline />
          <TextField label="Contenido HTML" value={form.contenido} onChange={(e) => campo('contenido', e.target.value)} fullWidth multiline minRows={7} />
          <CampoImagen valor={form.imagenUrl ?? ''} onCambio={(ruta) => campo('imagenUrl', ruta)} />
          <TextField label="Fecha" type="date" value={form.fecha ?? ''} onChange={(e) => campo('fecha', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          {/* El slug es la URL pública de la noticia: cambiarlo rompe los enlaces
              que ya se hayan compartido, así que se enseña sin poder tocarlo. */}
          <TextField label="Slug" value={form.slug ?? ''} fullWidth disabled />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch checked={form.visible} onChange={(e) => campo('visible', e.target.checked)} /> Visible públicamente
          </Box>
        </Stack>
      </PantallaEdicion>
    </>
  )
}
