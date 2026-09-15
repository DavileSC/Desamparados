import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { Helmet } from 'react-helmet-async'
import { useQueryClient } from '@tanstack/react-query'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import { getPortada, guardarImagenesPortada, type ImagenPortada } from '../../lib/api/portada'

/** Tope del servidor (portada.schema.ts): se avisa antes de enviar. */
export const MAX_FOTOS_PORTADA = 12
const AYUDA_FOTO = 'JPG, PNG o WebP apaisado, de al menos 1920 píxeles de ancho y hasta 5 MB.'

/** Una fila del formulario: la clave la da el propio CMS, para que React siga la fila al reordenar. */
interface Fila extends ImagenPortada {
  clave: number
}

let ultimaClave = 0
const conClave = (imagen: ImagenPortada): Fila => ({ ...imagen, clave: ++ultimaClave })
const sinClave = (filas: Fila[]): ImagenPortada[] => filas.map(({ url, descripcion }) => ({ url, descripcion }))

/** Fotos que rotan en la cabecera del inicio: se editan todas a la vez y se guardan en bloque. */
export default function PortadaAdminPage() {
  const queryClient = useQueryClient()
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [inicial, setInicial] = useState<ImagenPortada[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getPortada()
      .then(({ imagenes: lista }) => {
        setFilas(lista.map(conClave))
        setInicial(lista.map(({ url, descripcion }) => ({ url, descripcion })))
      })
      .catch(() => setError('No se han podido cargar las fotos de la portada.'))
  }, [])

  const cambiar = (clave: number, cambios: Partial<ImagenPortada>) =>
    setFilas((actual) => actual?.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)) ?? actual)

  const quitar = (clave: number) => setFilas((actual) => actual?.filter((fila) => fila.clave !== clave) ?? actual)

  const mover = (indice: number, salto: -1 | 1) =>
    setFilas((actual) => {
      if (!actual) return actual
      const destino = indice + salto
      if (destino < 0 || destino >= actual.length) return actual
      const copia = [...actual]
      copia[indice] = actual[destino]
      copia[destino] = actual[indice]
      return copia
    })

  const anadir = (url: string) => {
    if (!url) return
    setGuardado(false)
    setFilas((actual) => [...(actual ?? []), conClave({ url, descripcion: '' })])
  }

  const guardar = async () => {
    if (!filas) return
    setGuardando(true)
    setGuardado(false)
    setError(null)
    try {
      await guardarImagenesPortada(sinClave(filas))
      setInicial(sinClave(filas))
      setGuardado(true)
      // La portada pública comparte caché con el CMS en la misma pestaña: que
      // la siguiente visita al inicio pida la lista nueva en vez de la guardada.
      void queryClient.invalidateQueries({ queryKey: ['home', 'portada'] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se han podido guardar las fotos.')
    } finally {
      setGuardando(false)
    }
  }

  if (error && !filas) return <Alert severity="error">{error}</Alert>
  if (!filas) return <CircularProgress aria-label="Cargando las fotos de la portada" />

  const sucio = JSON.stringify(sinClave(filas)) !== JSON.stringify(inicial)

  return (
    <>
      <Helmet><title>Portada | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {guardado && !sucio && <Alert severity="success" sx={{ mb: 3 }}>Fotos guardadas. La portada ya las enseña en este orden.</Alert>}
      <PantallaEdicion
        titulo="Portada"
        nombre="Fotos que rotan en la cabecera del inicio"
        sucio={sucio}
        guardando={guardando}
        volverA="/cms"
        onGuardar={guardar}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Se enseñan en este orden, con un fundido de una a otra cada pocos segundos. Sin ninguna, la portada
          usa la foto de siempre. Las fotos que quites o cambies se borran del servidor al guardar, salvo que
          las use también una noticia o una publicación.
        </Typography>

        <Stack component="ol" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {filas.map((fila, indice) => (
            <Paper key={fila.clave} component="li" variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
                <Box sx={{ flex: 1 }}>
                  <CampoImagen
                    etiqueta={`Foto ${indice + 1}`}
                    ayuda={AYUDA_FOTO}
                    apaisada
                    valor={fila.url}
                    onCambio={(url) => (url ? cambiar(fila.clave, { url }) : quitar(fila.clave))}
                  />
                  <TextField
                    label="Descripción para lectores de pantalla"
                    value={fila.descripcion}
                    onChange={(e) => cambiar(fila.clave, { descripcion: e.target.value })}
                    helperText="Qué se ve en la foto, en una frase."
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    size="small"
                    fullWidth
                    sx={{ mt: 2 }}
                  />
                </Box>
                <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.5}>
                  <Tooltip title="Subir">
                    <span>
                      <IconButton aria-label={`Subir la foto ${indice + 1}`} disabled={indice === 0} onClick={() => mover(indice, -1)}>
                        <ArrowUpwardIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Bajar">
                    <span>
                      <IconButton aria-label={`Bajar la foto ${indice + 1}`} disabled={indice === filas.length - 1} onClick={() => mover(indice, 1)}>
                        <ArrowDownwardIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>

        <Box sx={{ mt: filas.length ? 3 : 0 }}>
          {filas.length < MAX_FOTOS_PORTADA ? (
            <CampoImagen etiqueta="Añadir una foto" ayuda={AYUDA_FOTO} apaisada valor="" onCambio={anadir} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ya hay {MAX_FOTOS_PORTADA} fotos, el máximo. Quita alguna para añadir otra.
            </Typography>
          )}
        </Box>
      </PantallaEdicion>
    </>
  )
}
