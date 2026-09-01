import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, MenuItem, Select, Stack, Switch, TextField } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import { useVolverAlListado } from '../../hooks/useVolverAlListado'
import { getAdminPublicationById, updatePublication, type PublicationPayload } from '../../lib/api/publications'
import type { PublicationItem } from '../../types'

const categorias: { value: PublicationItem['category']; label: string }[] = [
  { value: 'boletin', label: 'Boletín' }, { value: 'dossier', label: 'Dossier de prensa' },
  { value: 'anuario', label: 'Anuario' }, { value: 'historia', label: 'Historia' },
]

export default function PublicationEditPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  // El listado del que se vino, con su página y sus filtros: el enlace de editar
  // los trae en el state. Sin state (URL tecleada) se cae en la ruta pelada.
  const volverAlListado = useVolverAlListado('/cms/publicaciones')
  const [titulo, setTitulo] = useState('')
  const [form, setForm] = useState<PublicationPayload | null>(null)
  const [inicial, setInicial] = useState<PublicationPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getAdminPublicationById(Number(id))
      .then((item) => {
        const datos: PublicationPayload = {
          titulo: item.titulo, descripcion: item.descripcion ?? '', imagenUrl: item.imagenUrl ?? '',
          archivoUrl: item.archivoUrl, categoria: item.categoria, visible: item.visible, fecha: item.fecha.slice(0, 10),
        }
        setTitulo(item.titulo); setForm(datos); setInicial(datos)
      })
      .catch(() => setError('No se ha podido cargar la publicación.'))
  }, [id])

  const campo = (clave: keyof PublicationPayload, valor: string | boolean) => setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))

  const guardar = async () => {
    if (!form) return
    setGuardando(true)
    try {
      await updatePublication(Number(id), form)
      navegar(volverAlListado)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la publicación.')
      setGuardando(false)
    }
  }

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form) return <CircularProgress aria-label="Cargando la publicación" />

  return (
    <>
      <Helmet><title>Editar publicación | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo="Editar publicación"
        nombre={titulo}
        sucio={JSON.stringify(form) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA={volverAlListado}
        onGuardar={guardar}
      >
        <Stack spacing={2}>
          <TextField label="Título" value={form.titulo} onChange={(e) => campo('titulo', e.target.value)} fullWidth />
          <TextField label="Descripción" value={form.descripcion} onChange={(e) => campo('descripcion', e.target.value)} fullWidth multiline />
          <Select value={form.categoria} onChange={(e) => campo('categoria', e.target.value)} aria-label="Categoría">
            {categorias.map((categoria) => <MenuItem key={categoria.value} value={categoria.value}>{categoria.label}</MenuItem>)}
          </Select>
          <TextField label="URL del archivo PDF" value={form.archivoUrl} onChange={(e) => campo('archivoUrl', e.target.value)} fullWidth />
          <TextField label="URL de imagen" value={form.imagenUrl} onChange={(e) => campo('imagenUrl', e.target.value)} fullWidth />
          <TextField label="Fecha" type="date" value={form.fecha ?? ''} onChange={(e) => campo('fecha', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch checked={form.visible} onChange={(e) => campo('visible', e.target.checked)} /> Visible públicamente
          </Box>
        </Stack>
      </PantallaEdicion>
    </>
  )
}
